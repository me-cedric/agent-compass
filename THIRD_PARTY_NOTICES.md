# Third-Party Notices

## Every External Source Is Tracked, Not Redistributed

Agent Compass carries **no copy** of any external skill. All tracked sources in
[`skills/upstream-sources.json`](skills/upstream-sources.json) use
`"strategy": "reference"`: Agent Compass pins them, checks them for updates,
curates which of their skills it endorses, and installs them on request with
`agent-compass external-skills`. The copy is made into the host project or the
user's config, and the licence notice is written beside it at that moment.

This file therefore records what is tracked, not what is shipped. A host that
installs from one of these sources takes on that source's terms directly.

| Source | Licence | Holder | Curated |
| ------ | ------- | ------ | ------: |
| [`android/skills`](https://github.com/android/skills) | Apache-2.0 | Google LLC | 21 of 21 |
| [`dpearson2699/swift-ios-skills`](https://github.com/dpearson2699/swift-ios-skills) | PolyForm Perimeter 1.0.0 | dpearson2699 | 86 of 86 |
| [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) | MIT | Leonxlnx | 10 of 13 |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | MIT | DietrichGebert | 5 of 6 |
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | MIT | JuliusBrussee | 3 of 20 |
| [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) | MIT | ayghri | 1 of 1 |
| [`danyuchn/asd-ste100-skill`](https://github.com/danyuchn/asd-ste100-skill) | MIT | Dustin Yuchen Teng | 1 of 1 |
| [`firecrawl/anydoc`](https://github.com/firecrawl/anydoc) | MIT | Sideguide Technologies Inc. | 1 of 1 |

Two licences carry an obligation worth stating plainly:

- **PolyForm Perimeter 1.0.0** (`swift-ios-skills`) permits distribution only for
  a non-competing purpose, and requires its `Required Notice` line to travel with
  every copy. Agent Compass distributes nothing from it; the installer writes that
  line verbatim beside anything a host installs:
  `Required Notice: Copyright (c) 2025 dpearson2699 (https://github.com/dpearson2699)`.
- **Apache-2.0** (`android/skills`) requires attribution with any copy. The
  installer writes it.

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
