#!/usr/bin/env node
// Runs the four checks the open-questions register requires before saving.
// See docs/workflows/open-questions.md. Three checks are arithmetic, so they
// must run as a script and never by eye: a register whose arithmetic disagrees
// stops being trusted, and nobody reports it.
//
//   1. The deciders table total equals the sum of its rows, and the opening
//      sentence agrees with that total.
//   2. Every decision's three counts agree: the index row's actions cell, the
//      metadata line's "unblocks" count, and the number of blocked bullets.
//   3. The index table is sorted strictly descending by the actions count, and
//      the ranks run 1..N in order.
//   4. No code identifier, rule id, field name, HTTP status or file path
//      appears in a question, an option or a blocked bullet. The decider does
//      not read the repository.
//
// Usage: node scripts/check-questions.mjs [path]
// Exit code 0 when every check passes, 1 otherwise.
//
// TO ADOPT THIS SCRIPT: translate the LABELS block below into the language your
// register is written in, and set TICKET_PREFIXES to your own id families.
// Change nothing else. The checks do not depend on the language.

import { readFileSync } from 'node:fs'

const LABELS = {
  register: 'docs/OPEN-QUESTIONS.md',
  decidersHeading: '## Who must decide',
  indexHeading: '## The decisions, from the most unblocking to the least',
  totalCell: '**Total**',
  // The bold opening sentence carries both totals. The pattern must capture the
  // action count first and the decision count second.
  openingSentence: /^\*\*(\d+) actions? (?:are|is) blocked\./,
  metadataUnblocks: 'Unblocks',
  metadataDecider: 'Decider',
  metadataConcerns: 'Concerns',
  optionsHeading: '**Options**',
  blockedHeading: '**What is blocked today**',
  recommended: '*(recommended)*',
}

// Your own ticket, screen and rule id families. A decider never reads one.
const TICKET_PREFIXES = ['CAN', 'FEAT', 'TICKET']
const RULE_PREFIXES = ['RG', 'RULE', 'VAL', 'ERR', 'GD', 'Q']
// Personas that must never be abbreviated to a code inside a question.
const PERSONA_CODES = ['DPO', 'PM']

const target = process.argv[2] ?? LABELS.register
const text = readFileSync(target, 'utf8')
const lines = text.split('\n')
const failures = []

const fail = (check, message) => failures.push({ check, message })

/** Splits a markdown table row into trimmed cells, dropping the outer pipes. */
const cells = (row) => row.split('|').slice(1, -1).map((cell) => cell.trim())

const isTableRow = (line) => line.trimStart().startsWith('|')
const isAlignmentRow = (line) => /^\|[\s:|-]+\|$/.test(line.trim())

/** Collects the body rows of the first table that follows `heading`. */
function tableAfter(heading) {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return null
  const rows = []
  let seenHeader = false
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!isTableRow(line)) {
      if (rows.length > 0 || seenHeader) break
      continue
    }
    if (isAlignmentRow(line)) continue
    if (!seenHeader) {
      seenHeader = true
      continue
    }
    rows.push({ line, index: i + 1, cells: cells(line) })
  }
  return rows
}

// ---------------------------------------------------------------- check 1
const deciderRows = tableAfter(LABELS.decidersHeading)

if (!deciderRows) {
  fail(1, `heading "${LABELS.decidersHeading}" not found`)
} else {
  const totalRow = deciderRows.find((row) => row.cells[0].includes(LABELS.totalCell))
  const bodyRows = deciderRows.filter((row) => row !== totalRow)
  if (!totalRow) {
    fail(1, `the deciders table carries no ${LABELS.totalCell} row`)
  } else {
    const number = (cell) => Number(cell.replace(/\*/g, '').trim())
    const sumDecisions = bodyRows.reduce((acc, row) => acc + number(row.cells[1]), 0)
    const sumActions = bodyRows.reduce((acc, row) => acc + number(row.cells[2]), 0)
    const totalDecisions = number(totalRow.cells[1])
    const totalActions = number(totalRow.cells[2])
    if (sumDecisions !== totalDecisions) {
      fail(1, `decisions: rows sum to ${sumDecisions}, the Total row says ${totalDecisions}`)
    }
    if (sumActions !== totalActions) {
      fail(1, `actions: rows sum to ${sumActions}, the Total row says ${totalActions}`)
    }

    const opening = lines.find((line) => LABELS.openingSentence.test(line.trim()))
    if (!opening) {
      fail(1, 'the bold opening sentence carrying both totals is missing')
    } else {
      const [openActions, openDecisions] = opening.match(/\d+/g)?.map(Number) ?? []
      if (openActions !== totalActions) {
        fail(1, `opening sentence says ${openActions} actions, the table totals ${totalActions}`)
      }
      if (openDecisions !== totalDecisions) {
        fail(1, `opening sentence says ${openDecisions} decisions, the table totals ${totalDecisions}`)
      }
    }
  }
}

// ---------------------------------------------------------------- check 2 + 3
const indexRows = tableAfter(LABELS.indexHeading)
const unblocksRe = new RegExp(`\\*\\*${LABELS.metadataUnblocks} ?:\\*\\* (\\d+)`)

/** Every numbered decision section, with its metadata line and bullets. */
function decisionSections() {
  const sections = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^## (\d+)\. (.+)$/.exec(lines[i])
    if (!match) continue
    const end = lines.findIndex((line, j) => j > i && /^## /.test(line))
    const body = lines.slice(i + 1, end === -1 ? lines.length : end)
    const metadata = body.find((line) => unblocksRe.test(line))
    const blockedAt = body.findIndex((line) => line.trim() === LABELS.blockedHeading)
    const bullets = []
    if (blockedAt !== -1) {
      for (let j = blockedAt + 1; j < body.length; j += 1) {
        const line = body[j].trim()
        if (line.startsWith('- ')) bullets.push(line)
        else if (line === '' || line === '---') continue
        else if (line.startsWith('**') || line.startsWith('#')) break
      }
    }
    const options = []
    const optionsAt = body.findIndex((line) => line.trim() === LABELS.optionsHeading)
    if (optionsAt !== -1) {
      for (let j = optionsAt + 1; j < body.length; j += 1) {
        const line = body[j].trim()
        if (/^\d+\. /.test(line)) options.push(line)
        else if (line === '') continue
        else if (line.startsWith('**')) break
      }
    }
    sections.push({ rank: Number(match[1]), question: match[2], line: i + 1, metadata, bullets, options })
  }
  return sections
}

const sections = decisionSections()

if (!indexRows) {
  fail(2, `heading "${LABELS.indexHeading}" not found`)
} else {
  if (indexRows.length !== sections.length) {
    fail(2, `the index table has ${indexRows.length} rows but the document has ${sections.length} decision sections`)
  }

  const indexActions = []
  for (const row of indexRows) {
    const rank = Number(row.cells[0])
    const question = row.cells[1]
    const actions = Number(row.cells[3])
    indexActions.push({ rank, actions, line: row.index })

    const section = sections.find((candidate) => candidate.rank === rank)
    if (!section) {
      fail(2, `index row ${rank} has no matching "## ${rank}." section`)
      continue
    }

    // The question must be byte-identical between the index row and the heading.
    if (section.question !== question) {
      fail(2, `decision ${rank}: the heading and the index row differ.\n    index:   ${question}\n    heading: ${section.question}`)
    }

    if (!section.metadata) {
      fail(2, `decision ${rank}: no metadata line carrying the ${LABELS.metadataUnblocks} count`)
      continue
    }
    const declared = Number(unblocksRe.exec(section.metadata)?.[1])
    const bulletCount = section.bullets.length
    if (!(actions === declared && declared === bulletCount)) {
      fail(2, `decision ${rank}: the three counts disagree — index cell ${actions}, ${LABELS.metadataUnblocks} ${declared}, bullets ${bulletCount}`)
    }

    // Format details that make two registers diffable.
    if (!section.metadata.includes(LABELS.metadataDecider) || !section.metadata.includes(LABELS.metadataConcerns)) {
      fail(2, `decision ${rank}: the metadata line must carry ${LABELS.metadataDecider} and ${LABELS.metadataConcerns}`)
    }
    if ((section.metadata.match(/ · /g) ?? []).length !== 2) {
      fail(2, `decision ${rank}: the metadata line must separate its three fields with " · " (U+00B7)`)
    }
    if (section.options.length !== 3) {
      fail(2, `decision ${rank}: expected 3 options, found ${section.options.length}`)
    }
    const recommended = section.options.filter((option) => option.endsWith(LABELS.recommended))
    if (recommended.length !== 1) {
      fail(2, `decision ${rank}: exactly one option must end with ${LABELS.recommended}, found ${recommended.length}`)
    }
    for (const bullet of section.bullets) {
      if (!bullet.endsWith('.')) {
        fail(2, `decision ${rank}: a blocked bullet must end with a full stop — "${bullet.slice(0, 70)}"`)
      }
    }
  }

  // ------------------------------------------------------------- check 3
  for (let i = 1; i < indexActions.length; i += 1) {
    const previous = indexActions[i - 1]
    const current = indexActions[i]
    if (current.actions > previous.actions) {
      fail(3, `the index table is not sorted descending by actions: row ${previous.rank} has ${previous.actions}, row ${current.rank} has ${current.actions}`)
    }
  }
  const ranks = indexActions.map((row) => row.rank)
  const expected = ranks.map((_, i) => i + 1)
  if (ranks.join(',') !== expected.join(',')) {
    fail(3, `the index ranks must run 1..${ranks.length} in order, found ${ranks.join(',')}`)
  }
}

// ---------------------------------------------------------------- check 4
// A decider does not read the repository. These patterns catch what leaks.
const LEAKS = [
  { name: 'rule id', re: new RegExp(`\\b(?:${RULE_PREFIXES.join('|')})-[A-Z0-9]+(?:-[A-Z0-9]+)*\\b`) },
  { name: 'screen or ticket id', re: new RegExp(`\\b(?:${TICKET_PREFIXES.join('|')})-\\d+`) },
  { name: 'file path', re: /[\w./-]+\.(?:ts|tsx|js|mjs|json|md|sql|yml|yaml|feature|env)\b/ },
  { name: 'code identifier', re: /`[^`]+`/ },
  { name: 'SCREAMING_CASE constant', re: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/ },
  { name: 'camelCase identifier', re: /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/ },
  { name: 'HTTP status', re: /\b(?:200|201|204|400|401|403|404|409|422|429|500|501|503)\b/ },
  { name: 'persona abbreviated to its code', re: new RegExp(`\\b(?:${PERSONA_CODES.join('|')})\\b`) },
]

const recommendedRe = new RegExp(`${LABELS.recommended.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

for (const section of sections) {
  const surfaces = [
    { label: 'question', texts: [section.question] },
    { label: 'option', texts: section.options },
    { label: 'blocked bullet', texts: section.bullets },
  ]
  for (const { label, texts } of surfaces) {
    for (const raw of texts) {
      // The trailing recommendation marker is format, not prose.
      const value = raw.replace(recommendedRe, '').replace(/^\d+\.\s*/, '')
      for (const leak of LEAKS) {
        const hit = leak.re.exec(value)
        if (hit) {
          fail(4, `decision ${section.rank}, ${label}: ${leak.name} "${hit[0]}" — the decider does not read the repository`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------- report
const CHECKS = {
  1: 'the deciders table total equals the sum of its rows',
  2: "every decision's three counts agree",
  3: 'the index table is sorted strictly descending by the actions count',
  4: 'no code identifier, rule id, field name, HTTP status or file path in a question, an option or a bullet',
}

console.log(`${target} — ${sections.length} decisions\n`)
let failed = false
for (const id of Object.keys(CHECKS)) {
  const own = failures.filter((failure) => String(failure.check) === id)
  if (own.length === 0) {
    console.log(`  ok    check ${id}: ${CHECKS[id]}`)
  } else {
    failed = true
    console.log(`  FAIL  check ${id}: ${CHECKS[id]}`)
    for (const failure of own) console.log(`          ${failure.message}`)
  }
}
console.log('')
process.exit(failed ? 1 : 0)
