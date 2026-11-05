# CI speed levers

Free levers only. Keep the runners that the project has.
Measure one job before and after each change, on the same runner.

## Setup

- Cache the dependencies, keyed on the lockfile.
  - GitHub: `cache:` on `actions/setup-node`. A pull request restores a cache only from its own branch or from the base branch. Run the workflow on a push to the default branch too, or each new pull request starts cold.
  - GitLab: `cache:key:files` on the lockfile. GitLab keeps the caches of protected branches apart by default. Keep that setting: a shared cache lets any branch write what the default branch reads.
- For a job that reads history (a diff against the base, tags, a changelog), use `fetch-depth: 0` with `filter: blob:none`. Do not use a shallow clone there.
- Do not cache the Playwright browsers. Playwright says that a restore takes about as long as a download.
- Cancel a superseded pull request run. GitHub: `concurrency` with `cancel-in-progress`. GitLab: `interruptible: true`.

## Jobs

- Run lint, typecheck, build and tests as parallel jobs.
- Move extra work (migration checks, other apps) out of the slowest job.
- Set the test workers to the runner cores or fewer. More workers than cores is not faster, and it can make a test flaky.
- When CI runs only the changed projects (`nx affected`, `turbo --filter`), run the full suite on the default branch every night. Test the skip logic: a change that the tool cannot see must fail the run, not pass it.

## Tools

- **Oxlint before ESLint.** Add the dev dependency `oxlint`. Run `oxlint && eslint`.
  - Put `eslint-plugin-oxlint` last in the ESLint config, to turn off the rules that Oxlint already runs.
  - Keep ESLint for typed rules, for plugins that Oxlint does not have (`eslint-plugin-boundaries`) and for Angular templates.
  - Measured on 16,000 lines of compass JS: ESLint 1.3 s, Oxlint 0.35 s.
- **TypeScript 7 for the CLI typecheck.** 7.0 is stable. It has no API yet, so `typescript-eslint`, Angular templates, Vue, Svelte and Astro stay on 6.0.
  - Install both, as the TypeScript 7.0 release notes show:

    ```json
    { "devDependencies": {
      "typescript": "npm:@typescript/typescript6@^6.0.2",
      "@typescript/native": "npm:typescript@^7.0.2"
    } }
    ```

  - Then `tsc --noEmit` is 7.0, and `tsc6` and the tools use 6.0.
  - 7.0 changes defaults: `strict` is `true`, and `module` and `target` change. Set them in `tsconfig.json` first. Compare the errors of `tsc6` and `tsc` on one commit before CI uses 7.0.
  - Measured on compass JS with `checkJs`: 2.0 s on 6.0, 0.6 s on 7.0.
- **Vitest `isolate: false`.** Test files in one worker then share the module cache. It helps most when each file loads the whole app. It has no effect on the `vmThreads` and `vmForks` pools.
  - It comes with a rule: a `setupFiles` file resets the shared state in `afterAll`. Close the app and the connections. Clean the test database. Call `vi.restoreAllMocks()`, `vi.unstubAllEnvs()` and `vi.useRealTimers()`.
  - Run the suite with `--sequence.shuffle` a few times. A failure is a leak.
  - Jest has no such option.
- Do not adopt `bun check`: it needs the Bun runtime. Do not adopt `tsrs` yet: it is experimental.

## Local

- Run format, lint and typecheck in a `pre-push` hook (the `git-hooks` pack). Agents skip a step that is only a line in AGENTS.md. The compass guard stops `--no-verify`, so they cannot skip the hook.
- Keep the hook below about 10 seconds. Check only the changed files when the whole project is slower.
