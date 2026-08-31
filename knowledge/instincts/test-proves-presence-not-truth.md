---
id: test-proves-presence-not-truth
trigger: 'when a test guards documentation, help text, onboarding copy, a changelog, a translation set, or any prose artifact paired with code'
confidence: 0.85
domain: testing
source: host-project-promotion
---

# A test can prove a document exists. It cannot prove the document is still true.

## Action

Write the structural test — it is worth a lot:

- every route has exactly one guide, and every guide names a route that exists;
- every sentence key resolves in every language;
- the step count sits inside its declared range;
- every version heading parses, and the two changelogs list the same versions
  with the same item counts.

Then say plainly what it does not cover, next to it, and put the human half in
the workflow rather than in the assertion:

> `onboarding.test.ts` fails on a route with no guide and a guide naming a
> missing route. It cannot decide whether a sentence is still true. Read the
> guide of every page you change, and say in your handoff whether you updated
> it.

Two habits make that real:

1. **Report the prose you read, not the test that passed.** "Guide for the
   Downloads page re-read; the second step named the old button, corrected" is a
   finding. "Tests pass" is not.
2. **Prefer a structure the test can judge.** A step count read from the locale
   table, a `writes:` field naming a path, a version parsed from the manifest —
   each converts a sentence that can rot into a fact that can fail. Push as much
   of the document as you can into that shape, and accept that the remainder is
   read by people.

## Why

A green suite on a prose artifact produces the most confident kind of wrong.
Every mechanical property holds — the file is present, the keys resolve, the
counts agree — so the gate reports success while the paragraph describes a button
that was renamed two releases ago. Nothing in the run is capable of noticing, and
the passing gate is what stops anyone from looking.

The failure compounds because the test was added precisely so nobody would have
to check by hand. Naming the boundary is what keeps the human step in the
workflow: the test covers structure, the author covers truth, and the handoff
says which one was done.

Related: [[documentation-chain-followthrough]] (a documentation change is never
one file), [[spec-status-sync]] (verify status against wired code, not against a
label), [[verified-progress-signal]] (measure completion against code, never
against reported status).
