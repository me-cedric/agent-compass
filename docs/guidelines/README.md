# Guidelines

The enforced rules. `AGENTS.md` is the contract; these are the depth behind it.

| File                                              | Covers                                                        |
| ------------------------------------------------- | ------------------------------------------------------------- |
| [coding-style.md](coding-style.md)                | Immutability, file organization, error handling, validation. |
| [typescript.md](typescript.md)                    | TS specifics: strictness, response envelope, repository, hooks. |
| [testing-tdd.md](testing-tdd.md)                  | TDD loop, coverage, unit/integration/e2e, test selection.     |
| [security.md](security.md)                        | Mandatory checks, secrets, scanning, response protocol.       |
| [operational-safety.md](operational-safety.md)    | Authorization, dry-run, rollback, production, incident, and compliance gates. |
| [git-workflow.md](git-workflow.md)                | Conventional commits, branch naming, PRs, hooks.              |
| [development-workflow.md](development-workflow.md) | Research & reuse → plan → TDD → review → ship.                |
| [documentation.md](documentation.md)              | Per-module README/DESIGN, env.example, spec sync.             |
| [agent-behavior.md](agent-behavior.md)            | Completion gate, handoff, active-file rule, honesty.          |
| [performance.md](performance.md)                  | Model selection, context budget, build troubleshooting.       |

These are deliberately language-light where they can be; TypeScript/Node is the
reference ecosystem but the principles port.
