---
id: swift-type-check-budget
trigger: 'when a Swift test or view builds one long chained expression (filters, maps, string interpolation, arithmetic on mixed literals), and CI runs another Xcode than your machine'
confidence: 0.8
domain: build
source: host-project-promotion
---

# Keep each Swift expression inside the type checker's budget on every Xcode

## Action

Break a long chained expression into steps with typed constants. Check the
target with `-Xfrontend -warn-long-expression-type-checking=25` (milliseconds):
a warning there is a CI failure waiting for a slower compiler.

## Why

A UI-test target built on a local Xcode, and CI failed with `the compiler is
unable to type-check this expression in reasonable time` on one chained
expression. Another compiler version has another budget; the expression, not
the machine, was the fault.
