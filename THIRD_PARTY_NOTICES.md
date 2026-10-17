# Third-Party Notices

## Upstream Sources

Agent Compass ships no copy of an upstream skill. The file `upstream.json` pins each source by commit sha.

The command `ac sync` fetches a source into the user cache. It copies the skills of that source into a host only when the host lists the source id in `upstream` in `.agents/compass.json`.

The engine copies the licence file of the source into each installed skill directory.

This file records what Agent Compass tracks, not what it ships. A host that installs a source takes on the terms of that source.

| Source id | Repository | Licence | Holder | Skills |
| --------- | ---------- | ------- | ------ | ------ |
| `ponytail` | [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | MIT | DietrichGebert | `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-help`, `ponytail-review` |
| `caveman` | [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) (tag `v4.0.1`) | Apache-2.0 | Julius Brussee | `caveman`, `caveman-commit`, `caveman-review` |
| `i-have-adhd` | [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) | MIT | Ayoub Ghriss | `i-have-adhd` |
| `asd-ste100` | [`danyuchn/asd-ste100-skill`](https://github.com/danyuchn/asd-ste100-skill) | MIT | Dustin Yuchen Teng | `asd-ste100` |
| `taste` | [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) (tag `v2.0.0`) | MIT | Leonxlnx | `brandkit`, `taste-skill` (v2, `design-taste-frontend`), `taste-skill-v1`, `soft-skill`, `image-to-code-skill`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `brutalist-skill`, `minimalist-skill`, `redesign-skill`, `stitch-skill` |
| `expo` | [`expo/skills`](https://github.com/expo/skills) | MIT | 650 Industries, Inc. (Expo) | 23 skills under `plugins/expo/skills/`. `upstream.json` lists them. |
| `playwright-cli` | [`microsoft/playwright-cli`](https://github.com/microsoft/playwright-cli) | Apache-2.0 | Microsoft Corporation | `playwright-cli` |
| `angular` | [`angular/skills`](https://github.com/angular/skills) | MIT (frontmatter; no licence file in the repository) | Google LLC | `angular-developer`, `angular-new-app` |
| `android` | [`android/skills`](https://github.com/android/skills) | Apache-2.0 | Google LLC | 24 skills. `upstream.json` lists them. |
| `swift-ios` | [`dpearson2699/swift-ios-skills`](https://github.com/dpearson2699/swift-ios-skills) | PolyForm-Perimeter-1.0.0 | dpearson2699 | 86 skills. `upstream.json` lists them. |
| `dimillian` | [`Dimillian/Skills`](https://github.com/Dimillian/Skills) | MIT | Thomas Ricouard | `swift-concurrency-expert`, `swiftui-liquid-glass`, `swiftui-performance-audit`, `swiftui-ui-patterns`, `swiftui-view-refactor` |
| `agent-device` | [`callstack/agent-device`](https://github.com/callstack/agent-device) | MIT | Callstack | `agent-device`, `android-emulator`, `dogfood`, `ios-simulator` |
| `mattpocock` | [`mattpocock/skills`](https://github.com/mattpocock/skills) (tag `v1.3.1`) | MIT | Matt Pocock | `grill-me`, `grilling`, `grill-with-docs`, `to-questionnaire`, `wayfinder`, `handoff`, `tdd` |
| `apple-macos` | [`rshankras/claude-code-apple-skills`](https://github.com/rshankras/claude-code-apple-skills) | MIT | Ravishankar | `ui-review-tahoe`, `macos-capabilities` |
| `winui` | [`microsoft/winappCli`](https://github.com/microsoft/winappCli) | MIT | Microsoft Corporation and Contributors | `winui-design`, `winui-code-review`, `winui-dev-workflow` |
| `gtk` | [`alex-oleshkevich/glimpse`](https://github.com/alex-oleshkevich/glimpse) | BSD-3-Clause | Alex Oleshkevich | `developing-gtk-apps` |

Some licences carry an obligation:

- **MIT** requires the copyright notice and the licence text in every copy. The licence file that the engine copies meets this.
- **BSD-3-Clause** (`gtk`) requires the same notice, the conditions and the disclaimer in every copy. Do not use the holder name to endorse a product. The upstream skill file has no author line, and its text matches a skill in several repositories without a licence. The risk is low and recorded here on purpose.
- **Apache-2.0** (`android`, `playwright-cli`, `caveman`) requires attribution with any copy. The engine copies the licence file (`LICENSE.txt` in the android repository). `caveman` moved from MIT to Apache-2.0 at 3.0.0; its `NOTICE` text is below, and the engine copies the root `LICENSE` only, not the engine directories.
- **PolyForm Perimeter 1.0.0** (`swift-ios`) permits distribution only for a purpose that does not compete with the licensor. It requires the Required Notice line in every copy. Agent Compass distributes nothing from it. The licence file that the engine copies carries this line: `Required Notice: Copyright (c) 2025 dpearson2699 (https://github.com/dpearson2699)`.
- **MIT without a licence file** (`angular`): the repository states `license: MIT` and `Copyright 2026 Google LLC` in each skill's frontmatter and ships no licence file. `upstream.json` carries the MIT text in `licenceText`, and the engine writes it as `LICENSE` beside each installed skill. The owner accepted this on 2026-10-17.

### NOTICE of `caveman` (Apache-2.0)

```
Caveman
Copyright 2026 Julius Brussee

Before Caveman 3.0.0, the parts of this repository outside the Engine-linked
runtime were licensed under the MIT License (see LICENSING.md). Contributions
made to those parts before 3.0.0 were received under the MIT License and remain
available under it. Its copyright and permission notice is retained in
LICENSE-MIT.
```

The rest of that NOTICE names third-party software in the caveman engine, browser and CLI. Compass installs only the three skill directories, which hold none of it.

## Agent Compass Itself

MIT License

Copyright (c) 2026 CGI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
