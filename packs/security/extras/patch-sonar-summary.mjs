#!/usr/bin/env node
/**
 * Patches the HTML produced by `sonar-report` so the summary table,
 * CSS severity classes, pie chart, top metadata, detail-table severity
 * filter, and detection rendering all use SonarQube's modern severity
 * labels (BLOCKER / CRITICAL / MAJOR / MINOR / INFO) with accurate
 * counts derived from the corresponding `sonar-issues-*.csv` file.
 *
 * Usage:
 *   node scripts/patch-sonar-summary.mjs <csvPath> <htmlPath> [projectPrefix]
 *
 * Args:
 *   csvPath        Path to sonar-issues-*.csv with header
 *                  `type,severity,rule,message,component,line`.
 *   htmlPath       Path to sonar-report-*.html to patch in place.
 *   projectPrefix  Optional. If given, only rows whose `component` field
 *                  starts with `${projectPrefix}:` are counted (used to
 *                  reuse a combined CSV across multiple HTMLs in
 *                  `pnpm sonar:do`).
 *
 * Env (with fallbacks) for top metadata restore:
 *   SONAR_APPLICATION  (default: 'App' — pass explicitly per project)
 *   SONAR_RELEASE      (default: process.env.npm_package_version,
 *                       fallback 'unreleased')
 *   SONAR_BRANCH       (default: `git rev-parse --abbrev-ref HEAD`,
 *                       fallback 'N/A' if git is unavailable)
 *
 * Notable behaviors:
 *   - Strips the `<h3>Known Security Rules</h3>` catalogue block from the
 *     rendered HTML defensively (upstream `--no-rules-in-report` flag is not
 *     always honored by sonar-report@3.1.6).
 *   - Synthesizes the `<h2>Detail of the Detected Vulnerabilities</h2>` +
 *     issue table from the CSV when upstream omitted it (sonar-report can
 *     render 0 issues even when the CSV report cache has detections).
 *   - Filter UI + filter JS work unchanged against either upstream-rendered
 *     detail table or our synthetic one (column 1 = Severity preserved).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SEVERITIES = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'INFO'];
const COLORS = {
  BLOCKER: '#8B0000',
  CRITICAL: '#d43223',
  MAJOR: '#f39c12',
  MINOR: '#f7c73c',
  INFO: '#319ddb',
};

const fail = (msg) => {
  console.error(`\u274c ${msg}`);
  process.exit(1);
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const detectBranchFromGit = () => {
  // Graceful CI fallback: sonar:do doesn't hard-require git, and some
  // runners have no .git directory. The empty catch is intentional — we
  // surface the failure as a stable string instead of crashing the patch.
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'N/A';
  }
};

const [csvPath, htmlPath, projectPrefix] = process.argv.slice(2);
if (!csvPath || !htmlPath) {
  fail('Usage: node scripts/patch-sonar-summary.mjs <csvPath> <htmlPath> [projectPrefix]');
}
if (!existsSync(csvPath)) fail(`CSV not found: ${csvPath}`);
if (!existsSync(htmlPath)) fail(`HTML not found: ${htmlPath}`);

// Idempotency guard: skip silently if HTML has already been patched in a
// previous run (the upstream `sonar-report` invocation will overwrite the
// HTML on a fresh generation, so this only fires on isolated re-runs).
// The filter/data-severity markers below are also covered by this guard
// since they are introduced only when the rest of the patch runs.
let html = readFileSync(htmlPath, 'utf8');
if (html.includes('.sevBLOCKER')) {
  console.log(`\u2139\ufe0f  ${htmlPath} already patched, skipping`);
  process.exit(0);
}

// 1. Parse CSV -> severity counts AND retained row objects for downstream
// detail-table synthesis (in case upstream omitted it). CSV row format
// from `jq -r '.issues[] | [.type, .severity, ...] | @csv'`:
//   "TYPE","SEVERITY","rule","message","component","line"
// or — when jq emits a bare JSON number — the last field is unquoted:
//   "TYPE","SEVERITY","rule","message","component",<line>
// Inner field content can contain RFC-4180 escaped quotes (a literal "` is
// rendered as `""` inside the quoted field), so the message/rule/component
// patterns use `(?:[^"]|"")*` rather than `[^"]*`.
// Group 1 = type, 2 = severity, 3 = rule, 4 = message, 5 = component, 6 = line.
const ROW_RE = /^"(\w+)","([A-Z_]+)","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)","?([^,\n]*)"?$/;
const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
const csvRows = [];
for (const rawLine of readFileSync(csvPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) continue;
  if (/^"?type"?\s*,/i.test(line)) continue; // header
  const m = line.match(ROW_RE);
  if (!m) continue;
  if (projectPrefix) {
    // Bound to a single column so e.g. `<project>-api` does not match `<project>-api-extended`.
    if (!m[5].startsWith(`${projectPrefix}:`)) continue;
  }
  if (SEVERITIES.includes(m[2])) {
    counts[m[2]]++;
    csvRows.push({
      type: m[1],
      severity: m[2],
      rule: m[3].replace(/""/g, '"'),
      message: m[4].replace(/""/g, '"'),
      component: m[5].replace(/""/g, '"'),
      line: m[6],
    });
  }
}

// 2. Replace the 3 legacy CSS rules with 5 modern ones.
const oldCssMatch = html.match(
  /\.sevHIGH\s*\{\s*background-color:\s*#d43223\s*\}\s*\.sevMEDIUM\s*\{\s*background-color:\s*#f39c12\s*\}\s*\.sevLOW\s*\{\s*background-color:\s*#319ddb\s*\}/,
);
if (!oldCssMatch) {
  fail('CSS sevHIGH/sevMEDIUM/sevLOW rules not found - sonar-report template may have changed');
}
const newCss = SEVERITIES.map((s) => `.sev${s} {\n    background-color: ${COLORS[s]}\n}`).join('\n\n');
html = html.replace(oldCssMatch[0], newCss);

// 3. Replace the entire summary <table> with a fully modernized 5-row
// table. We target <table>...</table> rather than <tbody>...</tbody>
// because sonar-report@3.1.6 emits the summary block WITHOUT a <tbody>
// wrapper (the rows are written as raw <tr> siblings). The previous
// tbody-targeted indexOf() raced past the Summary block and latched onto
// the first <tbody> it found further down the document, which belonged
// to the "Known Security Rules" table — step 6 then stripped that rules
// block, wiping out the modernized rows we had just injected, while the
// original 0/0/0 HIGH/MEDIUM/LOW summary header stayed untouched. The
// full-table replacement makes the patch idempotent against that
// structural quirk and also keeps a clean anchor for step 4's SVG pie
// wrapper, which targets `<table` after the same `<h2>` marker.
const summaryIdx = html.indexOf('<h2>Summary of the Detected');
if (summaryIdx < 0) fail('Summary header not found in HTML');
const tableStart = html.indexOf('<table', summaryIdx);
const tableEnd = html.indexOf('</table>', tableStart) + '</table>'.length;
if (tableStart < 0 || tableEnd <= tableStart) fail('Summary table not found in HTML');

const newTable =
  `<table>\n` +
  `      <thead>\n` +
  `        <tr>\n` +
  `          <th></th>\n` +
  `          <th>Severity</th>\n` +
  `          <th>Number of Issues</th>\n` +
  `        </tr>\n` +
  `      </thead>\n` +
  `      <tbody>\n` +
  SEVERITIES.map(
    (s) =>
      `        <tr>\n` +
      `          <td class="sev${s}"></td>\n` +
      `          <td>${s}</td>\n` +
      `          <td>\n` +
      `            ${counts[s]}\n` +
      `          </td>\n` +
      `        </tr>`,
  ).join('\n') +
  `\n      </tbody>\n` +
  `    </table>`;
html = html.slice(0, tableStart) + newTable + html.slice(tableEnd);

// 4. Pie chart for the Summary section.
//
// `sonar-report@3.1.6` is the upstream renderer. Two template paths exist:
//   - Legacy: a `<canvas id="vulnerabilitiesPieChart">` + drawing script
//     with `var data = [a, b, c]` and `var colors = [...]` using the legacy
//     HIGH/MEDIUM/LOW tiers.
//   - Conditional-gated: the whole canvas+script block is wrapped in
//     `<% if (issues.length > 0) %>`, and with our `pnpm sonar:do`
//     flag combination (`--allbugs --no-security-hotspot`) that gate is
//     silent — neither canvas nor arrays are emitted, leaving the legacy
//     `var data` patch with no anchor to mutate.
//
// We considered keeping a legacy in-place branch that rewrote the upstream
// arrays in place, but rejected it: the upstream drawing script only
// consumes `data[0..2]` / `colors[0..2]`, so a 5-element injection would be
// silently truncated and render the wrong 3-tier breakdown. Instead we
// always inject a self-contained inline SVG donut next to the summary
// <table>. SVG is JS-free, deterministic, renders all 5 modern severities
// (instead of collapsing them into 3), and uses the COLORS map above for
// visual consistency with the `.sevXxx` CSS classes installed in step 2.
// Idempotent via the `id="synthetic-pie-wrapper"` sentinel: the sentinel
// itself is irrelevant for fresh runs (the top-of-file `.sevBLOCKER` guard
// already handles full re-applies), but it covers the edge case of a
// partial manual run where only some of the patches landed.
//
// If upstream emits the canvas block again in a future version (e.g. with
// a `--no-pie` opt-out or a 5-element-aware script), revisit this design
// and add an opt-in path: detect `<canvas id="vulnerabilitiesPieChart">`
// + rewrite the drawing script instead of injecting our own.
if (!html.includes('id="synthetic-pie-wrapper"')) {
  // viewBox 42x42 with circle r=15.9155 → circumference ≈ 100 user units,
  // so pathLength="100" lets each segment use clean percent values. A
  // negative stroke-dashoffset chains slices around the start angle (12
  // o'clock, after the -90deg rotation). Zero-count severities emit no
  // circle; the donut collapses correctly when only one severity is
  // non-zero. Floating-point pct sum stays < 100 ± 0.001 thanks to
  // `.toFixed(3)`, so slices neither gap nor overlap meaningfully.
  const total = SEVERITIES.reduce((a, s) => a + counts[s], 0);
  const circles = [];
  let offset = 0;
  for (const s of SEVERITIES) {
    if (counts[s] === 0) continue;
    const pct = (counts[s] / total) * 100;
    circles.push(
      `          <circle r="15.9155" cx="21" cy="21" fill="transparent" stroke="${COLORS[s]}" stroke-width="10" pathLength="100" stroke-dasharray="${pct.toFixed(3)} ${(100 - pct).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}"></circle>`,
    );
    offset += pct;
  }
  if (circles.length === 0) {
    // Defensive: zero total — emit a neutral gray placeholder so the chart
    // region still has visual weight instead of collapsing to a dot.
    circles.push(
      `          <circle r="15.9155" cx="21" cy="21" fill="transparent" stroke="#cccccc" stroke-width="10"></circle>`,
    );
  }

  // Caption shows counts per severity for readers who can't visually
  // distinguish the thin donut wedges. Three spans per severity, in order:
  // color swatch (fixed 10×10 box) → severity label → count. Each span is
  // independent so the swatch's 10×10 box doesn't accidentally clamp the
  // label text inside it.
  const captionItems = SEVERITIES.map(
    (s) =>
      `          <span style="display:inline-block;width:10px;height:10px;margin:0 6px 0 12px;border-radius:2px;background-color:${COLORS[s]};"></span>${s}<span style="margin-left:4px;color:#666;">(${counts[s]})</span>`,
  ).join('\n');

  const svg =
    `        <svg width="140" height="140" viewBox="0 0 42 42" role="img" aria-label="Severity distribution donut chart" style="transform: rotate(-90deg); flex-shrink: 0;">\n` +
    circles.join('\n') +
    `\n        </svg>`;

  const caption =
    `        <div style="font-family: sans-serif; font-size: 13px; line-height: 1.8; color: #333; flex-grow: 1;">\n` +
    `          <div style="font-weight: 600; margin-bottom: 4px;">Severity breakdown</div>\n` +
    captionItems +
    `\n        </div>`;

  // Wrap the existing summary <table> in a flex container so the SVG sits
  // to the left of the table. The Summary header (`<h2>Summary of the
  // Detected`) is still above the wrapper, preserving upstream semantics.
  const summaryIdx2 = html.indexOf('<h2>Summary of the Detected');
  const tableStart = html.indexOf('<table', summaryIdx2);
  const tableEnd = html.indexOf('</table>', tableStart) + '</table>'.length;
  if (tableStart > 0 && tableEnd > tableStart) {
    const wrapper =
      `\n      <div id="synthetic-pie-wrapper" data-patched="true" style="display: flex; align-items: center; gap: 24px; margin: 12px 0; padding: 12px; background: #fafafa; border: 1px solid #eee; border-radius: 4px;">\n` +
      svg +
      `\n` + caption + `\n` +
      html.slice(tableStart, tableEnd) +
      `\n      </div>\n`;
    html = html.slice(0, tableStart) + wrapper + html.slice(tableEnd);
    console.log(`[svg-pie] Injected synthetic SVG donut (upstream canvas+arrays were absent) for ${htmlPath}`);
  } else {
    console.warn(`Could not locate Summary <table> to inject synthetic pie chart in ${htmlPath}; skipping`);
  }
}

// 5. Restore top metadata (Application / Release / Branch).
// The sonar-report template emits these `<dd>` as whitespace-only when the
// upstream CLI args are not provided. We leave populated ones alone and
// inject the env-derived value into empty ones. Idempotent: replace only
// matches `<dd>...</dd>` whose trimmed content is empty.
const metaValues = {
  // `npm_package_name` resolves to \"<project>\" at the repo root, which is not
  // a useful per-project fallback, so we intentionally skip it for
  // Application — the pnpm scripts pass SONAR_APPLICATION explicitly.
  Application: process.env.SONAR_APPLICATION || 'App',
  Release: process.env.SONAR_RELEASE || process.env.npm_package_version || 'unreleased',
  Branch: process.env.SONAR_BRANCH || detectBranchFromGit(),
};

for (const [field, value] of Object.entries(metaValues)) {
  // Empty-dd regex is the authoritative emptiness check: matches only
  // `<dt>FIELD</dt>\n      <dd>\n        \n      </dd>` with whitespace-only content.
  const emptyDdRe = new RegExp(`<dt>${field}</dt>\\s*<dd>\\s*<\\/dd>`);
  if (emptyDdRe.test(html)) {
    html = html.replace(emptyDdRe, `<dt>${field}</dt>\n      <dd>\n        ${value}\n      </dd>`);
    console.log(`\ud83d\udd11 Restored ${field} metadata \u2192 ${value}`);
    continue;
  }
  // Either the cell was already populated by upstream (sonar-report may
  // pick this up via --application/--release/--branch flags), or the
  // template schema changed and this <dt> label no longer exists. The
  // presence check is intentionally loose; the empty-dd regex above is
  // the source of truth. The drift case is surfaced as a soft warning so
  // CI doesn't fail but template drift stays visible.
  const present = new RegExp(`<dt>${field}</dt>`).test(html);
  if (!present) {
    console.warn(`\u26a0\ufe0f  <dt>${field}</dt> not found in ${htmlPath}; sonar-report template may have changed`);
  } else {
    console.log(`\u2139\ufe0f  <dd> for ${field} already populated; left untouched`);
  }
}

// 6. Strip the `<h3>Known Security Rules</h3>` + `<table class="rulestable">`
// catalogue block. sonar-report@3.1.6's `--no-rules-in-report` flag is not
// reliably honored by the upstream template, so this is the authoritative
// way to keep only detections in the rendered report. The strip is bounded
// by the `<h3>` opening and the closing `</table>` of the rules table; we
// intentionally do NOT consume the surrounding `<div class=detail>` because
// detail section may legitimately contain other content we want to keep.
const knownRulesRe = /<h3>Known Security Rules<\/h3>[\s\S]*?<\/table>/;
if (knownRulesRe.test(html)) {
  const stripped = html.match(knownRulesRe)[0];
  html = html.replace(knownRulesRe, '');
  console.log(`\ud83d\uddd1\ufe0f  Stripped Known Security Rules block (${stripped.length} bytes) from ${htmlPath}`);
}

// 7. Detail section: anchor on `<h2>Detail of the Detected Vulnerabilities`
// when upstream emitted it, OR synthesize from CSV when it didn't (the
// upstream's `issues.length > 0` gate can be false even when the CSV
// report has detections — in that case we render the synth ourselves).
// In both cases the resulting HTML is regex-compatible with the same
// `<h2>...<table>...</table>` shape, so subsequent steps (filter UI, JS)
// work unchanged.
let detailHeadingIdx = html.indexOf('<h2>Detail of the Detected Vulnerabilities');
const totalCsvRows = csvRows.length;
if (detailHeadingIdx < 0 && totalCsvRows > 0) {
  // Synthesize: derive base URL from existing <a href="... /dashboard?id=..."> link.
  const baseUrlMatch = html.match(/<a href="(https?:\/\/[^/]+)\/dashboard/);
  const baseUrl = baseUrlMatch?.[1] ?? '';
  if (!baseUrl) {
    console.warn(`\u26a0\ufe0f  Could not derive sonarBaseURL for synthetic rule links (no \`/dashboard?id=\` anchor found); using /coding_rules/ fallback`);
  }
  const safeBase = escapeHtml(baseUrl);

  // Strip the optional `<prefix>:` prefix from component so the rendered
  // filename starts at the first path separator.
  const stripPrefix = (component) =>
    projectPrefix && component.startsWith(`${projectPrefix}:`)
      ? component.slice(projectPrefix.length + 1)
      : component;

  const synthRow = (r) => {
    const rule = escapeHtml(r.rule);
    const component = escapeHtml(stripPrefix(r.component));
    const msg = escapeHtml(r.message);
    const line = escapeHtml(r.line || 'N/A');
    const ruleHref = `${safeBase}/coding_rules#rule_key=${rule}`;
    return (
      `        <tr>\n` +
      `          <td><a href="${ruleHref}" target="_blank">\n` +
      `              ${rule}\n` +
      `            </a></td>\n` +
      `          <td class="sev${r.severity}">${r.severity}</td>\n` +
      `          <td class="component">${component}</td>\n` +
      `          <td>${line}</td>\n` +
      `          <td></td>\n` +
      `          <td>${msg}</td>\n` +
      `          <td class="hidden"></td>\n` +
      `          <td>OPEN</td>\n` +
      `        </tr>`
    );
  };

  const synth =
    `\n    <h2>Detail of the Detected Vulnerabilities</h2>\n` +
    `    <table id="detail-table">\n` +
    `      <thead>\n` +
    `        <tr>\n` +
    `          <th>Rule</th>\n` +
    `          <th>Severity</th>\n` +
    `          <th>Component</th>\n` +
    `          <th>Line</th>\n` +
    `          <th>Description</th>\n` +
    `          <th>Message</th>\n` +
    `          <th class="hidden">Key</th>\n` +
    `          <th>Status</th>\n` +
    `        </tr>\n` +
    `      </thead>\n` +
    `      <tbody>\n` +
    csvRows.map(synthRow).join('\n') +
    `\n      </tbody>\n` +
    `    </table>\n`;

  // Inject the synthetic block right before the (now-stripped) `<div class=detail>`
  // opening, or as a fallback right before the closing `</div>` of `<div class="summup">`
  // if the wrapper div is missing for some reason. Inserting before detail div keeps
  // it logically grouped with other detail content.
  const injectBefore = html.indexOf('<div class=detail>');
  const injectFallback = html.indexOf('</div>', summaryIdx);
  const injectAt = injectBefore >= 0 ? injectBefore : injectFallback;
  if (injectAt < 0) fail('Cannot find injection anchor for synthetic detail section');
  html = html.slice(0, injectAt) + synth + html.slice(injectAt);
  detailHeadingIdx = html.indexOf('<h2>Detail of the Detected Vulnerabilities');
  console.log(`\ud83c\udf1f Synthesized detail section from CSV (${totalCsvRows} rows) into ${htmlPath}`);
}

if (detailHeadingIdx < 0 && totalCsvRows === 0) {
  console.warn(`\u26a0\ufe0f  Detail heading not found AND CSV has zero issues — nothing to render for ${htmlPath}`);
}

// 8. Inject an interactive severity filter above the detail table.
// The synthesized `<h2>` produces the same anchor shape as upstream, so
// the existing `detailHeadingIdx` works for both cases.
if (detailHeadingIdx >= 0) {
  // `<table` with word boundary matches both `<table>` (no attrs) and
  // `<table class="...">` etc. The first table after the H2 is the
  // issue detail table on every observed template version (Rules come
  // — or used to come — later, but we now strip them in step 6).
  const detailTableIdx = html.indexOf('<table', detailHeadingIdx);
  if (detailTableIdx < 0) {
    fail('Detail `<table` not found after `<h2>Detail of the Detected Vulnerabilities`');
  }

  const filterUI =
    `\n    <div id="severity-filter" data-patched="true" style="margin: 12px 0; padding: 10px; background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; font-family: sans-serif;">\n` +
    `      <strong style="margin-right: 8px;">Filter by severity:</strong>\n` +
    `      <button type="button" class="severity-filter-btn" data-sev="ALL" style="margin-right: 6px; padding: 4px 10px; cursor: pointer; font-weight: bold;">All (${SEVERITIES.reduce((a, s) => a + counts[s], 0)})</button>\n` +
    SEVERITIES.map(
      (s) =>
        `      <button type="button" class="severity-filter-btn" data-sev="${s}" style="margin-right: 6px; padding: 4px 10px; cursor: pointer; border-left: 4px solid ${COLORS[s]};">${s} (${counts[s]})</button>`,
    ).join('\n') +
    `\n    </div>\n`;

  html = html.slice(0, detailTableIdx) + filterUI + html.slice(detailTableIdx);
}

// 9. Inject the filter script before `</body>` (idempotent: anchored on the
// closing body tag of the document). Skipped entirely if step 7 / 8 above
// didn't produce a detail heading, since the script depends on the filter
// UI having been injected.
if (detailHeadingIdx >= 0) {
  const filterScript =
    `\n  <script>\n` +
    `    (function () {\n` +
    `      var filterEl = document.getElementById('severity-filter');\n` +
    `      if (!filterEl) return;\n` +
    `      // The filter UI's next sibling is the detail table we just\n` +
    `      // injected before; walk forward in case the bbox has any non-table\n` +
    `      // intermediate nodes (e.g. comments, whitespace) so we always\n` +
    `      // anchor on the actual <table>.\n` +
    `      var detailTable = filterEl.nextElementSibling;\n` +
    `      while (detailTable && detailTable.tagName !== 'TABLE') {\n` +
    `        detailTable = detailTable.nextElementSibling;\n` +
    `      }\n` +
    `      if (!detailTable) return;\n` +
    // The detail table columns are: 0=Rule, 1=Severity, 2=Component, 3=Line,
    // 4=Description, 5=Message, 6=Key (hidden), 7=Status. Tag every row with
    // `data-severity` so CSS / the filter buttons can pivot on it.
    `      var rows = detailTable.querySelectorAll('tbody tr');\n` +
    `      Array.prototype.forEach.call(rows, function (tr) {\n` +
    `        var sevCell = tr.cells[1];\n` +
    `        if (sevCell) tr.setAttribute('data-severity', sevCell.textContent.trim());\n` +
    `      });\n` +
    `      var buttons = filterEl.querySelectorAll('.severity-filter-btn');\n` +
    `      Array.prototype.forEach.call(buttons, function (btn) {\n` +
    `        btn.addEventListener('click', function () {\n` +
    `          var target = btn.getAttribute('data-sev');\n` +
    `          Array.prototype.forEach.call(buttons, function (b) {\n` +
    `            var active = (b === btn);\n` +
    `            b.style.fontWeight = active ? 'bold' : 'normal';\n` +
    `            b.style.backgroundColor = active ? '#e0e0e0' : '';\n` +
    `            b.setAttribute('aria-pressed', active ? 'true' : 'false');\n` +
    `          });\n` +
    `          Array.prototype.forEach.call(rows, function (tr) {\n` +
    `            if (target === 'ALL') {\n` +
    `              tr.style.display = '';\n` +
    `            } else {\n` +
    `              tr.style.display = (tr.getAttribute('data-severity') === target) ? '' : 'none';\n` +
    `            }\n` +
    `          });\n` +
    `        });\n` +
    `      });\n` +
    `    })();\n` +
    `  </script>\n`;

  const bodyCloseIdx = html.lastIndexOf('</body>');
  if (bodyCloseIdx < 0) fail('`</body>` not found in HTML');
  html = html.slice(0, bodyCloseIdx) + filterScript + html.slice(bodyCloseIdx);
}

writeFileSync(htmlPath, html);
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(
  `\u2705 Patched ${htmlPath} (${total} total: ${SEVERITIES.map((s) => `${s}=${counts[s]}`).join(', ')})`,
);
