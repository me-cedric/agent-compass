#!/usr/bin/env node
/**
 * Auto-closes SonarQube issues that are still flagged OPEN server-side but
 * are no longer detected by the latest scanner run (i.e. the offending code
 * has been removed/edited but the issue wasn't auto-closed — usually because
 * the project hasn't configured `sonar.scm.provider=git` server-side, or
 * because the file falls in `sonar.exclusions`, or because the scanner was
 * invoked from a shallow clone with no usable SCM info).
 *
 * The "freshly detected" set of issues comes from the CSV produced by
 * `pnpm sonar:do` (via `jq -r ... @csv` of the
 * `/api/issues/search?componentKeys=<key>` response). Anything still OPEN
 * in SonarQube but NOT in that CSV is considered stale and transitioned
 * via `/api/issues/bulk_change?issues=<keys>&transition=resolve`.
 *
 * Safety:
 *   - Default is DRY-RUN: prints what would be closed, never POSTs.
 *   - `--apply` is the only flag that triggers real transitions.
 *   - Missing SONAR_TOKEN → soft warning + exit 0 (no failures in local
 *     / preview contexts).
 *   - Bulk batches of 100 keys + 500 ms delay between batches to keep
 *     the server database from thrashing on large sweeps.
 *   - Pagination via `p`/`ps` (ps=500 = max) so projects with hundreds
 *     of open issues are handled in one go.
 *
 * Match key: `${rule}:${componentWithoutProjectPrefix}:${line || 'N/A'}`.
 *   - Rule is exact (e.g. typescript:S3776).
 *   - Component is the file path the scanner ran against, sans the
 *     `<projectKey>:` prefix SonarQube attaches server-side.
 *   - Line falls back to 'N/A' so file-level findings (no specific line)
 *     still match against CSV rows that emit `"N/A"` for line.
 *
 * Idempotency: SONAR_TOKEN is the only secret touched. The script only
 * considers `statuses=OPEN,REOPENED,CONFIRMED`, and `/api/issues/bulk_change`
 * silently ignores issue keys that are no longer in those statuses — so a
 * second run resolves nothing and exits cleanly.
 *
 * Post-closure CSV refresh: when `--apply` succeeds (no failed batches),
 * the script re-queries `/api/issues/search` and overwrites the input CSV
 * file with the post-closure state, so subsequent `pnpm sonar:do`
 * runs read the cleaned-up data without re-fetching stale issues.
 *
 * Usage:
 *   node scripts/bulk-close-stale-issues.mjs \
 *     --project=<project>-api --csv=sonar-issues-api.csv [--apply]
 */

import { argv, env, exit, stderr, stdout } from 'node:process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SONAR_HOST = env.SONAR_HOST ?? 'http://localhost:9002';
const PAGE_SIZE = 500;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 500;
const SEVERITIES = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];

const args = new Map();
for (const a of argv.slice(2)) {
  const eq = a.indexOf('=');
  if (eq < 0) {
    args.set(a.replace(/^--/, ''), 'true');
  } else {
    args.set(a.slice(2, eq), a.slice(eq + 1));
  }
}

const projectKey = args.get('project');
const csvPath = args.get('csv');
const apply = args.get('apply') === 'true';

if (!projectKey) {
  stderr.write('Missing --project=<key> (e.g. <project>-api)\n');
  exit(2);
}
if (!csvPath) {
  stderr.write('Missing --csv=<path> (path to the freshly-generated sonar-issues-*.csv)\n');
  exit(2);
}
if (!existsSync(csvPath)) {
  stderr.write(`CSV not found: ${csvPath}\n`);
  exit(2);
}

if (!env.SONAR_TOKEN) {
  stdout.write(
    `[skip] SONAR_TOKEN missing — ${projectKey}: stale-issue cleanup skipped (set SONAR_TOKEN to enable)\n`,
  );
  exit(0);
}

const auth = `Basic ${Buffer.from(`${env.SONAR_TOKEN}:`).toString('base64')}`;
const headers = { Authorization: auth, Accept: 'application/json' };

const stripPrefix = (component) =>
  component && component.startsWith(`${projectKey}:`)
    ? component.slice(projectKey.length + 1)
    : component;

const matchKey = (rule, component, line) =>
  `${rule}:${stripPrefix(component) ?? ''}:${line ?? 'N/A'}`;

// 1. Build the "detected right now" key set from the CSV.
// CSV header: type,severity,rule,message,component,line.
// Inner field content can contain RFC-4180 escaped quotes (a literal `"`
// is rendered as `""` inside the quoted field), so the rule/message/
// component patterns use `(?:[^"]|"")*` rather than `[^"]*`.
const ROW_RE = /^"(\w+)","([A-Z_]+)","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)","?([^,\n]*)"?$/;
const detected = new Set();
for (const rawLine of readFileSync(csvPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) continue;
  if (/^"?type"?\s*,/i.test(line)) continue; // header
  const m = line.match(ROW_RE);
  if (!m) continue;
  detected.add(matchKey(m[3].replace(/""/g, '"'), m[5].replace(/""/g, '"'), m[6]));
}

// 2. Paginate /api/issues/search for OPEN/REOPENED/CONFIRMED issues.
// CONFIRMED and REOPENED still require action from SonarQube's perspective,
// so they're in the pool that may be stale.
const STATUSES = 'OPEN,REOPENED,CONFIRMED';
const fetchOpenIssues = async () => {
  const all = [];
  let page = 1;
  for (;;) {
    const url =
      `${SONAR_HOST}/api/issues/search?componentKeys=${encodeURIComponent(projectKey)}` +
      `&statuses=${STATUSES}&p=${page}&ps=${PAGE_SIZE}&additionalFields=_all`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    for (const i of data.issues ?? []) all.push(i);
    const total = data.total ?? all.length;
    if (all.length >= total || (data.issues ?? []).length < PAGE_SIZE) return all;
    page += 1;
  }
};

const openIssues = await fetchOpenIssues();
const stale = openIssues.filter(
  (i) => !detected.has(matchKey(i.rule, i.component, i.line && String(i.line))),
);

// 3. Summarize the diff.
stdout.write(
  `\u2139\ufe0f  ${projectKey}: detected=${detected.size} open=${openIssues.length} ` +
    `stale=${stale.length}${apply ? ' (will transition)' : ' (dry-run)'}\n`,
);
if (stale.length === 0) {
  stdout.write(`\u2705 ${projectKey}: nothing to close\n`);
  exit(0);
}

const preview = stale.slice(0, 20).map((i) => {
  const file = stripPrefix(i.component) ?? i.component;
  return `  - ${i.key}  ${i.rule}  ${file}:${i.line ?? '?'}`;
});
stdout.write(`First ${Math.min(20, stale.length)} stale issues:\n${preview.join('\n')}\n`);
if (stale.length > 20) stdout.write(`  ... and ${stale.length - 20} more\n`);

if (!apply) {
  stdout.write(`\n[dry-run] Pass --apply to actually POST transitions.\n`);
  exit(0);
}

// 4. Batch POST /api/issues/bulk_change. transition=resolve (not falsepositive
// or wontfix) is correct for issues whose detection has disappeared: they are
// genuinely fixed-by-removal, not human-judged false positives.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let succeeded = 0;
let failedBatches = 0;
let hinted403 = false;
for (let i = 0; i < stale.length; i += BATCH_SIZE) {
  const batch = stale.slice(i, i + BATCH_SIZE).map((x) => x.key);
  const url =
    `${SONAR_HOST}/api/issues/bulk_change?issues=${encodeURIComponent(batch.join(','))}` +
    `&transition=resolve`;
  try {
    const res = await fetch(url, { method: 'POST', headers });
    if (!res.ok) {
      failedBatches += 1;
      stderr.write(`[fail] batch ${i / BATCH_SIZE + 1}: ${res.status} ${res.statusText}\n`);
      if (res.status === 403 && !hinted403) {
        stderr.write(
          '[hint] 403 Forbidden on bulk_change — re-run `pnpm sonar:setup` to migrate from GLOBAL_ANALYSIS_TOKEN to USER_TOKEN (needed for issue-transitions).\n',
        );
        hinted403 = true;
      }
    } else {
      succeeded += batch.length;
      stdout.write(`[ok] batch ${i / BATCH_SIZE + 1}: ${batch.length} issues resolved\n`);
    }
  } catch (err) {
    failedBatches += 1;
    stderr.write(`[fail] batch ${i / BATCH_SIZE + 1}: ${err.message}\n`);
  }
  if (i + BATCH_SIZE < stale.length) await sleep(BATCH_DELAY_MS);
}

stdout.write(
  `\n\u2705 ${projectKey}: resolved ${succeeded} stale issue(s)` +
    `${failedBatches > 0 ? ` (${failedBatches} batch(es) failed \u2014 check server logs)` : ''}\n`,
);

// 5. Post-closure CSV refresh. Only runs in apply mode AND when no batch
// failed (partial closures would leave some stale issues still OPEN, so the
// CSV would still legitimately list them — rewriting then would erase the
// progress record). The output format matches `jq -r '.issues[] | [...] |
// @csv'` from the package.json sonar:do scripts.
if (failedBatches === 0) {
  try {
    // Same OPEN+REOPENED+CONFIRMED status filter as fetch_csv in
    // sonar-do.sh: keeping the CSV to actionable statuses means a later
    // scanner that auto-closes more issues will leave a clean CSV behind,
    // and historical RESOLVED entries won't inflate the next diff.
    const csvUrl =
      `${SONAR_HOST}/api/issues/search?componentKeys=${encodeURIComponent(projectKey)}` +
      `&statuses=OPEN,REOPENED,CONFIRMED&ps=${PAGE_SIZE}`;
    const csvRes = await fetch(csvUrl, { headers });
    if (!csvRes.ok) {
      stderr.write(`[warn] could not refresh CSV at ${csvPath} (${csvRes.status}); left untouched\n`);
    } else {
      const csvData = await csvRes.json();
      const lines = ['type,severity,rule,message,component,line'];
      for (const i of csvData.issues ?? []) {
        if (!SEVERITIES.includes(i.severity)) continue;
        // RFC-4180-style escaping: wrap fields that may contain quotes,
        // commas, or newlines in double-quotes with internal quotes doubled.
        const esc = (v) => {
          const s = v == null ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : `"${s}"`;
        };
        lines.push([
          esc(i.type ?? 'BUG'),
          esc(i.severity),
          esc(i.rule ?? ''),
          esc(i.message ?? ''),
          esc(i.component ?? ''),
          esc(i.line ?? 'N/A'),
        ].join(','));
      }
      mkdirSync(dirname(csvPath), { recursive: true });
      writeFileSync(csvPath, lines.join('\n') + '\n');
      stdout.write(`\u2139\ufe0f  refreshed ${csvPath} with post-closure state (${csvData.total ?? lines.length - 1} issues)\n`);
    }
  } catch (err) {
    stderr.write(`[warn] CSV refresh failed: ${err.message}; left untouched\n`);
  }
}
