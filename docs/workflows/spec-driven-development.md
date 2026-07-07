# Spec-Driven Development

Use this when the request is large enough that unclear intent would cause rework:
new projects, new features, behavior changes, high-risk fixes, and ambiguous
daily tasks.

The goal is not heavy process. The goal is a short, shared source of truth before
implementation.

## Flow

1. **Idea** - Capture what the user wants and why.
2. **Spec** - Write behavior, users, requirements, non-goals, and acceptance
   criteria. Do not choose the tech stack here.
3. **Clarify** - Resolve `[NEEDS CLARIFICATION]` markers before planning.
4. **Plan** - Translate the approved spec into technical approach, affected
   surfaces, validation, and doc/spec sync.
5. **Tasks** - Break the plan into test-first, ordered tasks. Mark parallel-safe
   tasks with `[P]`.
6. **Implement** - Execute tasks against the spec and plan.
7. **Converge** - Compare code, tests, docs, and specs. Update whichever artifact
   is stale.

## Artifact layout

Use `specs/<id-slug>/` for project and feature artifacts:

```text
specs/
  README.md
  constitution.md
  000-project/
    spec.md
    plan.md
    tasks.md
    checklist.md
  001-feature-name/
    spec.md
    plan.md
    tasks.md
    checklist.md
```

Start new projects at `specs/000-project/`. Use the next numbered folder for
features and changes.

## Modes

| Mode | Required artifact |
| ---- | ----------------- |
| New project | Full `000-project` spec, plan, tasks, checklist. |
| Feature/change | Full numbered spec folder unless the change is trivial. |
| Bugfix | Short spec section or linked existing spec, plus focused plan/tasks. |
| Small daily task | Inline spec brief is enough: goal, non-goal, acceptance, validation. |

## Brownfield rule

For existing features, search `specs/` first. Update or link the existing spec
instead of creating disconnected truth. If behavior changes, add a new numbered
change spec and reference the older spec it supersedes or extends.

## Optional upstream Spec Kit

Agent Compass ships native templates and does not require GitHub Spec Kit. Teams
that already use Spec Kit can use it alongside this workflow:

```bash
python3 --version  # upstream Spec Kit currently documents Python 3.11+
uv --version       # uv recommended; pipx is another supported install path
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
specify init . --integration copilot
```

Typical upstream command order:

```text
/speckit.constitution
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.analyze
```

Keep upstream tooling updates separate from feature artifact updates. Agent
Compass remains the baseline contract; Spec Kit is an optional artifact generator.

To add provider-facing helpers for a Spec Kit project, run:

```bash
agent-compass spec-kit-bridge .
agent-compass skills-sync . --only speckit-constitution,speckit-specify,speckit-clarify,speckit-plan,speckit-tasks,speckit-analyze,speckit-checklist,speckit-implement,speckit-converge,speckit-agent-context-update,speckit-taskstoissues
```

The bridge creates generic GitHub Copilot `speckit.*` prompts and custom agents.
It does not install the upstream Spec Kit CLI.
