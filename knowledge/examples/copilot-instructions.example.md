# Copilot Engineering Workflow

IMPORTANT: Agents must use `skills:caveman` for concise interactions and must consult the project's Dual Graph MCP before non-trivial edits (call `graph_continue` then `graph_read` the recommended files). See `CLAUDE.md` / `AGENTS.md` for canonical rules.

## 1. Planning (Mandatory)

* For any non-trivial task, start with a step-by-step plan
* Do NOT write code before the plan is validated
* Break tasks into small, verifiable steps

## 2. Execution

* Implement one step at a time
* Clearly state which step is being executed
* Avoid making multiple changes at once

## 3. Verification (Required)

* Never consider a task complete without validation
* Always include:

  * how to test
  * expected results
  * edge cases
* If possible, provide or update tests

## 4. Code Quality

* Prefer simple and minimal solutions
* Avoid hacks or temporary fixes
* Fix root causes instead of symptoms
* Limit changes to only what is necessary

## 5. Refactoring & Elegance

* If a solution feels hacky, propose a cleaner alternative
* For complex changes, evaluate if a better design exists
* Do not over-engineer simple problems

## 6. Bug Fixing

* Identify root cause using logs, errors, or failing tests
* Fix directly without unnecessary clarification
* Do not require step-by-step guidance from the user

## 7. Iteration & Self-Improvement

* When a mistake is corrected, update `/tasks/lessons.md`
* Extract general rules from errors
* Apply lessons to future tasks

## 8. Task Tracking

* Use `/tasks/todo.md` to plan and track progress
* Mark tasks as complete as you go
* Add a short review when finished

## 9. Behavior Rules

* Do not jump straight to coding
* Do not assume correctness
* Think like a senior engineer reviewing your own work
