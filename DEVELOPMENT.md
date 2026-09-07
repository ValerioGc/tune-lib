# TuneLib - Development guide

Technical documentation for anyone developing, testing or releasing TuneLib. For the end-user product description, see [README.md](README.md).

Target platforms are **Windows** (NSIS installer) and **Linux** (AppImage and `.deb`). macOS is not supported.

## Stack

| Area           | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Frontend       | Vue 3 (Composition API, `<script setup>`) + TypeScript |
| Styling        | SCSS, no CSS framework: an in-house design system      |
| Desktop shell  | Tauri 2                                                |
| Backend / core | Rust                                                   |
| Build tool     | Vite                                                   |
| Frontend tests | Vitest + Vue Test Utils                                |
| Backend tests  | Rust's own test harness (`cargo test`)                 |
| Quality        | ESLint, Prettier, Clippy, SonarQube                    |

Key libraries: `lofty` (tags and cover art for MP3, FLAC, M4A, OGG, WAV), `serde`/`serde_json` (library persistence) and `thiserror` on the Rust side; `pinia` (state) and `vue-i18n` (translations) on the frontend. There is no router: the views are few and flat. Preferences are persisted with `tauri-plugin-store`, the system autostart entry through `tauri-plugin-autostart`, and playback uses the webview's native `<audio>` fed through the app's own `track:` scheme (`src-tauri/src/protocol.rs`), which answers each request only for a file the library is holding at that moment. The tray icon comes from Tauri's own `tray-icon` feature.

## Requirements

- Node.js `22.14.0` (the version used in CI, see `.github/workflows/ci.yml`)
- Rust stable `1.85+`, installed via `rustup`
- **Windows**: Visual Studio Build Tools with the C++ workload and a Windows SDK; WebView2
  is also required. Windows 11 normally includes WebView2, but not the MSVC build tools.
- **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `build-essential`, `libssl-dev`
- For `npm run coverage:rust`: `cargo install cargo-llvm-cov` and `rustup component add llvm-tools-preview`, once

## Setup

```bash
npm install
npm run dev       # launches the desktop app in development mode
```

## Commands

| Command                                       | Description                                                 |
| --------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                 | Full desktop app in development mode (Tauri + Vite)         |
| `npm run dev:web`                             | Frontend only, in a browser, without the Tauri shell        |
| `npm run build`                               | Type check (`vue-tsc`) + production build of the frontend   |
| `npm run build:app`                           | Builds the native bundles for the current platform          |
| `npm run test`                                | Frontend test suite (Vitest)                                |
| `npm run test:watch`                          | Frontend test suite in watch mode                           |
| `npm run test:coverage`                       | Frontend tests with coverage, thresholds enforced           |
| `npm run test:e2e`                            | Playwright browser scenarios from Cucumber `.feature` files |
| `npm run test:rust`                           | Rust test suite (`cargo test`)                              |
| `npm run coverage:rust`                       | Rust coverage in lcov, fails under 80% of functions         |
| `npm run typecheck`                           | `vue-tsc --noEmit`                                          |
| `npm run lint` / `lint:fix`                   | ESLint                                                      |
| `npm run format` / `format:check`             | Prettier                                                    |
| `npm run lint:rust`                           | Clippy with `-D warnings`                                   |
| `npm run format:rust` / `format:rust:check`   | `cargo fmt`                                                 |
| `npm run verify`                              | Frontend gate: format + lint + typecheck + coverage         |
| `npm run verify:rust`                         | Rust gate: fmt + clippy + coverage                          |
| `npm run verify:all`                          | Both gates                                                  |
| `npm run build:pages`                         | Regenerates the GitHub Pages site in `docs/`                |
| `npm run check:pages`                         | Fails if `docs/` is out of date (used in CI)                |
| `npm run docker:sonar:up` / `:down` / `:logs` | Local SonarQube instance                                    |
| `npm run test:sonar`                          | Generates every report and runs the Sonar analysis          |

`verify` and `verify:rust` are the two gates to clear at the end of a phase: each fails on its own if function coverage drops below 80%.

## Project structure

```
tune-lib/
├─ src/                        # Vue 3 frontend
│  ├─ assets/help/             # optional guide screenshots
│  ├─ styles/                 # SCSS: tokens, themes, mixins, global stylesheet
│  ├─ components/             # each area split by the part of it a component belongs to
│  │  ├─ common/               # reusable base components: controls, input, placeholder
│  │  ├─ help/                 # in-app guide
│  │  ├─ layout/               # custom window titlebar
│  │  ├─ library/              # header, table, preview, groups, messages, dialogs
│  │  ├─ metadata/             # metadata editors, and the fields they are built from
│  │  ├─ player/               # layout (bar, dock, full view) and controls
│  │  └─ settings/             # layout (section, tabs) and the sections themselves
│  ├─ composables/             # list virtualisation, drag & drop, foreground timers
│  ├─ config/                  # shared configuration, guide topics, icons, layout
│  ├─ i18n/                    # vue-i18n instance and locale detection
│  ├─ locales/                 # translation files (it, en, fr, es, de)
│  ├─ services/                # preferences, appearance, colour, library commands, audio
│  ├─ stores/                  # Pinia
│  ├─ types/
│  └─ views/
├─ src-tauri/
│  ├─ capabilities/            # Tauri permissions, minimal allowlist
│  ├─ src/
│  │  ├─ commands/             # commands exposed to the frontend, window included
│  │  ├─ library/              # library file persistence
│  │  ├─ metadata/             # tag and cover art reading and writing
│  │  ├─ catalog.rs            # list of libraries and the active one
│  │  ├─ state.rs              # shared library state
│  │  └─ lib.rs, main.rs
│  └─ tauri.conf.json
├─ src/tests/
│  ├─ unit/                    # store, service, composable and config specs
│  ├─ component/               # Vue component and view specs
│  └─ e2e/                     # Playwright browser tests expressed as Gherkin features
├─ tests/backend/              # Rust integration tests
├─ docs/                       # generated GitHub Pages site
└─ scripts/                    # build and release helpers
```

Frontend tests live under `src/tests/`: Vitest specs are split between `unit/` and `component/`,
while browser scenarios live in `e2e/features/` as Gherkin `.feature` files. Their Cucumber step
definitions and browser hooks live beside them under `e2e/steps/` and `e2e/support/`.
Rust integration tests live under `tests/backend/`; Rust unit tests live in `#[cfg(test)]` modules
inside the files they cover.

Run the frontend suites with `npm test` and the Gherkin browser suite with `npm run test:e2e`.
The latter starts a temporary Vite server on port `1421` and launches headless Chromium through
Playwright. Set `E2E_PORT` to use another free port.

A plain browser has no library to read and no file to play. Scenarios that need either one are
tagged `@shell`: the hooks then install `e2e/support/shell.js`, a stand-in for the desktop shell
that answers the commands the flow asks for, serves a fixture track and cover, and carries the
events the main window and the floating dock speak to each other with. It also keeps a note of
every command it was asked for, so a scenario can check what the shell was told to do.

### Main window, floating player and close confirmation

The floating player is a second Tauri window (`mini`), opened by `commands/window.rs` on the
same bundle with `index.html?view=mini`; `src/main.ts` reads that parameter and mounts
`views/MiniPlayerView.vue` instead of `App.vue`.

The audio is played by the main webview, and a webview dies with the window that holds it, so
the dock is a remote control rather than a second player. The two talk over Tauri events, in
`services/mini-player-bridge.ts`: the main window publishes `mini://state`, the dock sends
`mini://command`. Anything the dock changes in the settings is read back from the same store
file, which is also how it follows the theme.

The close confirmation is a third window (`mini-confirm`), mounted through
`index.html?view=mini-confirm`. It starts hidden and always on top. After Vue mounts its
content, `showCurrentWindow()` shows it and then requests focus. Do not wait for
`requestAnimationFrame` before showing a hidden webview: its frame callbacks may be paused.

Each window has a capability file: `default.json`, `mini-player.json` or `mini-confirm.json`.
The confirmation explicitly needs `core:window:allow-show`, `allow-set-focus` and `allow-close`.
Core plugin permissions must be granted to the window that invokes them; `core:default`
does not authorize every window operation.

All three windows are built in Rust rather than automatically from configuration (`"create": false` on the main window in
`tauri.conf.json`), so each can be handed the two guards in `keep_inside_the_app`: a webview
that leaves the pages of the app would run beside its commands, so it is not allowed to
navigate anywhere else, nor to open a window for a page it was asked to.

### Volume and default-player detection

`services/audio-engine.ts` maps the slider's 0–1 value directly to audio amplitude, clamps
it to the supported range and multiplies it by the track's gain correction. The same
engine serves the bar, full player and floating controls, including preloaded tracks.

On Windows, `commands/default_player.rs` uses `AssocQueryStringW` to read the effective
executable for every extension in `metadata::SUPPORTED_EXTENSIONS`. Canonical paths are
compared with the running executable, so another installation with the same filename is
not mistaken for this one. Queries run on a blocking worker and never change associations.
The frontend checks on mount and window focus. A successful match hides the reminder
without persisting a dismissal; unsupported platforms return `null` and retain the manual
reminder. The Windows-only `windows-sys` dependency supplies the native bindings.

### In-app guide and translations

Guide content lives in `src/locales/help/{locale}.json`, separate from the main translation
files. Each topic has `title`, `where`, `sections` (with `title` and `text`) and `tip`.
`HelpText.vue` renders named Vue i18n slots for controls and keyboard keys; do not put raw
HTML in translations. Topic order, icons and optional figures live in `src/config/help.ts`.

Optional PNG figures belong in `src/assets/help/`. Each configured figure names its file
and an arrow position in percentages, with a clockwise angle in degrees (0 points right,
90 points down). Missing images are omitted. Figure captions use the topic's `figure` key.
Keep all five locales in sync, including removal of unused keys, and retain dynamic key
families used by selectors and guide sections. Diagnostic strings and test descriptions
are English; localized UI assertions intentionally verify the selected language.

## The library file, and what an export adds to it

A library is a JSON file: a schema version, a name, the metadata gathered from the tracks
and the tracks themselves (`src-tauri/src/library/mod.rs`). It is written through a
temporary file that replaces the original once complete, so an interrupted save cannot
truncate it.

An export is the same file with a header. `LibraryExport` writes an `export` object at the
top naming the app, its version, the operating system and architecture that produced it,
when it was written, and the mode used. Two modes:

| Mode    | Carries                                    | Read back by                            |
| ------- | ------------------------------------------ | --------------------------------------- |
| `full`  | The library as it stands, artwork included | Reading the entries out of the file     |
| `paths` | Only the paths of the tracks               | Reading the tags from those files again |

A `full` export is byte for byte a library file with one extra object in it, so an older
version of the app opens it as a library and ignores the header. `load_for_import` reads
either shape, along with any library file written by an earlier schema.

## Development rules

These apply to **every** step and are part of the definition of done.

1. **Code quality**: the code must clear SonarQube (no Blocker/Critical issues, no blocking code smells, no duplication).
2. **SCSS**: all styling is SCSS. Nesting and name separation use a **single** `_`:

   ```scss
   // correct
   .library_table {
     &_row { ... }
     &_cover { ... }
   }
   // => .library_table_row, .library_table_cover

   // do NOT use __ or --
   ```

3. **Componentisation**: no monolithic components. Each component has a single responsibility.
4. **Tests**: every step ships tests keeping function coverage at **80%** or better, on both sides.
5. **TypeScript**: strict mode, no implicit `any`.
6. **Errors**: no unjustified `unwrap()` in Rust. Errors are typed, propagated and turned into a message a user can understand.
7. **i18n**: every string a user can see — labels, error messages, tooltips, dialog text — goes through `vue-i18n`. No hardcoded strings in components.
8. **Language**: code, comments and documentation are written in English, impersonally. The interface is translated through `vue-i18n` into the five locales, and Italian is the default among them — no user-facing string is written in the source.
9. **Class names must be literal**: the CSS goes through PurgeCSS, which keeps only the class names the sources spell out. A class built from a prop — ``:class="`card_${size}`"`` — is dropped from the stylesheet without a word, and the component renders unstyled in the packaged app. Bind an object with the names written out instead.
10. **HTML5 drag and drop is unavailable**: the window keeps Tauri's native file drop (`dragDropEnabled`, on by default), which on Windows takes the drag events away from the webview. Reordering inside the app is done with pointer events, as in the column settings dialog.
11. **Edits are staged, and the leftovers are swept**: a tag is written on a copy named `{stem}.mal-tmp.{ext}` beside the original, which replaces it only once the write is complete — so an interrupted edit cannot corrupt the file. A copy the process did not live long enough to remove is cleared at the next start, off the main thread, and only once it is older than `STAGING_MAX_AGE` (`metadata::write::remove_abandoned_staging_files`). Anything walking a folder of audio files has to skip these, since a staged copy carries the extension of its original.
12. **A command never opens a path it was handed**: a path arriving from the webview is checked against what the app already knows — a track of the open library, or the file the operating system passed at startup — before anything is read from disk (`ensure_known_file` in `commands/metadata.rs`). Files the user picks arrive through the system dialog, which returns paths the shell itself produced.
13. **A picture is what its bytes are**: the type written beside a picture in a tag is a claim by whoever made the file. Reading and writing both identify PNG and JPEG from the first bytes (`metadata::image_mime`) and refuse anything else, so nothing unrecognised reaches a `data:` URL. A picture heavier than `MAX_EMBEDDED_COVER_BYTES` is reported back by weight instead of being loaded — the editor says why, and the cache keeps the answer so the file is not opened again for it.
14. **What arrives in a library file is not this app's writing**: a library is made to be exchanged, so importing one drops the entries that do not name an audio file before they enter (`drop_unplayable_tracks`). Together with rule 12 that is what keeps `prepare_playback` — the one command that hands the webview raw bytes off the disk — pointed at audio and nothing else.

## Style guidelines

The theme follows the modern Windows look (Fluent / Windows 11):

- Layered surfaces with rounded corners and soft shadows.
- One accent colour across every interactive control, chosen by the user and adjusted per theme so it stays readable.
- Short, natural transitions on hover, press and focus.
- Spacing from the token scale (`$space_*`); the horizontal page margin (`$page_gutter`) is shared by the content, the titlebar and the player.
- Surfaces from the `surface_panel` mixin, or `glass_surface` for the content surfaces that follow the glass setting.
- Scrollable regions from the `scroll_area` mixin, with one thin scrollbar in both themes.
- Measurements in `rem`, so the interface follows the text size setting, list row height included.

## Testing and coverage

- **Frontend**: Vitest + jsdom + Vue Test Utils. Thresholds are configured in `vite.config.ts`: 80% for lines, functions and statements, 75% for branches.
- **Backend**: `cargo test` on the `tune-lib` crate. Coverage via `cargo llvm-cov`, with `main.rs` and `lib.rs` excluded because they are wiring.
- The list is virtualised, so a row only exists while it is on screen: tests that count rows have to account for the window rather than the whole track list.

## Static analysis (SonarQube)

Configuration lives in `sonar-project.properties`. A local scan needs Docker:

```powershell
npm run docker:sonar:up      # start a local SonarQube instance
npm run docker:sonar:logs    # wait for "SonarQube is operational", then Ctrl+C
# open http://localhost:9000 (admin/admin), change the password, generate a token
$env:SONAR_TOKEN = "..."
npm run test:sonar           # produces every report, then runs the analysis
npm run docker:sonar:down    # stop SonarQube
```

`test:sonar` always regenerates the three reports the configuration points at — frontend coverage, Rust coverage and the Clippy JSON report — before scanning: an analysis run against stale reports says nothing about the code being analysed.

> The `-v "%cd%:/usr/src"` in `test:sonar` is `cmd` syntax, the shell npm uses on Windows. On Linux it has to become `$PWD`.

## GitHub Pages site

The site text for every locale lives in `docs/site-content.json`. The HTML pages under `docs/` and its per-language folders are **generated** by `scripts/build-pages.cjs`; do not edit them by hand. After changing the content:

```bash
npm run build:pages
npm run check:pages   # fails if docs/ is out of date
```

The builder reads the list of languages back from `LOCALES` in `src/types/settings.ts` and fails if the site and the app do not offer the same ones.

Deployment runs through `.github/workflows/pages.yml`, on push to `main` when the relevant paths change, or manually from GitHub → Actions → "GitHub Pages" → _Run workflow_.

## Release process

`.github/workflows/ci.yml` runs only when a `vMAJOR.MINOR.PATCH` tag is pushed, and:

1. **test**: the whole quality chain — Prettier, ESLint, `vue-tsc`, `cargo fmt`, Clippy, the frontend and Rust suites with coverage, the browser scenarios, `docs/` verification and the frontend build.
2. **verify-release**: checks that the tag is valid semver, that it points at a commit reachable from `main`, that the version matches `package.json`, `tauri.conf.json` and `Cargo.toml`, and that `CHANGELOG.txt` has a section for it.
3. **build-windows / build-linux**: native bundles through `tauri build`.
   - Windows: NSIS installer (`.exe`), in the five interface languages, install mode `both`. The four translated message files come from `src-tauri/nsis/` rather than from the bundler, whose copies are broken or incomplete; the comment at the head of each file says what was wrong.
   - Linux: AppImage (portable, any distribution) and `.deb`. The runner is pinned to `ubuntu-22.04`: the AppImage links against the runner's glibc, and a newer one would refuse to start on older distributions.
4. **create-release**: publishes a GitHub Release with the bundles, their SHA-256 checksums and release notes taken from the changelog.

### Asset naming

| Platform              | Filename                                        |
| --------------------- | ----------------------------------------------- |
| Windows               | `TuneLib_{version}_windows_x64.exe`             |
| Linux (portable)      | `TuneLib_{version}_linux_x64_portable.AppImage` |
| Linux (Debian/Ubuntu) | `TuneLib_{version}_linux_x64.deb`               |

### Publishing a release

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. All three must match.
2. Add a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.txt`.
3. Commit to `main`.
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

`scripts/extract-changelog.cjs <version>` prints the section for one version and is used by both `verify-release` and the release notes.

## Known open points

Deliberate debts rather than oversights. None of them blocks the remaining work.

| Point                                    | State                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tauri commands tested through state only | The commands are one-line delegations to `LibraryState`, which the tests cover. Testing across the IPC bridge (`tauri::test::mock_builder`) was tried and dropped: on Windows the test executable cannot find `WebView2Loader.dll`.                                                                                                                                                                                    |
| TypeScript held at 6.x                   | `vue-tsc` 3.3.x does not support TypeScript 7 (the `./lib/tsc` export was removed). Raising one means raising the other.                                                                                                                                                                                                                                                                                               |
| M4A and OGG fixtures missing             | Both formats go through the same `lofty` API as the others, but no generated file proves it: building one by hand needs a complete MP4/Ogg container.                                                                                                                                                                                                                                                                  |
| `style-src 'unsafe-inline'` in the CSP   | Vue writes `:style` bindings out as inline `style` attributes, and the accent colour and the ambient background are set as custom properties on the root element. Dropping the directive means dropping those, and CSP3 hashes do not cover attributes. It is the weakest line of the policy and it stays: `script-src` is `'self'` with no inline scripts, and that is the line deciding whether a page can run code. |
| No watcher on the library folders        | The files are read again when the app starts, when a library is opened, and one at a time before a track is played or edited. A change made while the list sits on screen is not seen until one of those: watching the filesystem is not implemented.                                                                                                                                                                  |
