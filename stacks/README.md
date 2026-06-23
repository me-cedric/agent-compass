# Stack Presets

Opinionated starting points the bootstrap offers. Each preset names the
components, the agent-compass pieces it pulls in (skills, templates, guidelines),
and the validation commands — so the **same answers yield the same project**.

| Preset                              | Use for                                          |
| ----------------------------------- | ------------------------------------------------ |
| [turbo-monorepo.md](turbo-monorepo.md) | The umbrella: pnpm + turbo workspace + tooling. |
| [nestjs-api.md](nestjs-api.md)      | Backend API (NestJS + Drizzle + BullMQ + OTel).  |
| [react-admin.md](react-admin.md)    | Admin/back-office SPA (Vite + React + MUI).       |
| [expo-mobile.md](expo-mobile.md)    | Mobile app (Expo Router + React Native).          |

Presets compose: a typical product is `turbo-monorepo` + one or more apps.
Adding a preset? Document it here **and** wire it into `scripts/bootstrap.mjs`
(see [CONTRIBUTING](../CONTRIBUTING.md)).
