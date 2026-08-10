# Guidelines

The enforced rules. `AGENTS.md` is the contract; these are the depth behind it.

| File                                              | Covers                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| [coding-style.md](coding-style.md)                | Immutability, file organization, error handling, validation. |
| [typescript.md](typescript.md)                    | TS specifics: strictness, multi-project typecheck, response envelope, repository, hooks. |
| [testing-tdd.md](testing-tdd.md)                  | TDD loop, coverage, unit/integration/e2e, test selection, test names. |
| [security.md](security.md)                        | Mandatory checks, secrets, argv rule, agent permission tiers, scanning, response protocol. |
| [operational-safety.md](operational-safety.md)    | Authorization, dry-run, rollback, production, incident, and compliance gates. |
| [git-workflow.md](git-workflow.md)                | Conventional commits, branch naming, PRs, hooks.              |
| [development-workflow.md](development-workflow.md) | Research & reuse → plan → TDD → review → ship.                |
| [documentation.md](documentation.md)              | Per-module README, DESIGN.md sections, language per audience, env.example, spec sync. |
| [agent-behavior.md](agent-behavior.md)            | Completion gate, handoff, active-file rule, honesty.          |
| [style-contract.md](style-contract.md)            | Opt-in always-on contract for ponytail / i-have-adhd / caveman / asd-ste100. |
| [performance.md](performance.md)                  | Model selection, context budget, build troubleshooting.       |

These are deliberately language-light where they can be; TypeScript/Node is the
reference ecosystem but the principles port.
