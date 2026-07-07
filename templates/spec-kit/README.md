# Spec Kit Provider Pack

Optional provider-facing helpers for projects that use GitHub Spec Kit.

Run:

```bash
agent-compass spec-kit-bridge .
```

This creates:

- `.specify/` bridge config and docs
- `docs/spec-kit/README.md`
- GitHub Copilot prompt files for `speckit.*`
- GitHub Copilot custom agents for `speckit.*`

It does not install upstream Spec Kit. Install/update upstream tooling
separately, then keep generated specs under review.
