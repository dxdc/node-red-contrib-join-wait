# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.2] - 2026-05-09

### Fixed

- **Open example flows button** was a no-op. Now invokes
  `core:show-examples-import-dialog` directly, opening the dialog as a
  modal above the edit tray.
- **Wait paths editableList overlapped the form rows below it** for
  long lists. Resized via the canonical Node-RED pattern (numeric
  height + `oneditresize` filling the tray, no upper clamp); re-flows
  on the Advanced `<details>` toggle.
- **Persist store admin call** now prefixes `RED.settings.apiRootUrl`,
  so it works under a custom `httpAdminRoot` or behind a reverse
  proxy.
- **Help text** no longer references the file-based persistence path
  removed in 0.6.0; corrected to describe the context-store backend.

### Added

- **Bulk paste in path lists** — paste newline-separated text into any
  Wait paths or Reset paths row to fill the row + append one row per
  remaining line.
- **Richer inline validation** — output preview reflects
  `pathTopicType` and shows repeat counts as `path_1 (×2): …`;
  duplicate Reset paths and overlap between Wait/Reset paths are
  flagged inline; Timeout accepts fractional values.
- Tests for the `/join-wait/stores` admin endpoint and drift fences
  in `editor_spec.js` so the help text never re-acquires legacy keys.

### Changed

- Persist store row hides when Preserve queue is off; output-preview
  and Advanced summary use Node-RED CSS variables (theme-aware);
  Timeout field widths cleaned up.

## [0.6.1] - 2026-05-08

### Fixed

- Shipped example flows wouldn't import — inject nodes were missing
  the standard top-level `topic`, `payload`, `repeat`, `crontab`,
  `once`, and `onceDelay` fields. All five examples regenerated in
  the canonical inject format.
- First attempt at fixing the **Open example flows** button (closed
  the edit tray before invoking the import dialog) — didn't reliably
  surface; see 0.6.2 for the working fix.

## [0.6.0] - 2026-05-08

### Added

- **Modern `(msg, send, done)` input handler** — proper async-message
  tracking and graceful shutdown (the old auto-completion fired
  before awaited work resolved).
- **Editor UX overhaul** — Wait paths and Reset paths now use
  `editableList` (add/remove/reorder rows; inline validation for
  empty rows + invalid regex; Enter adds the next). Inline output
  preview, smart short-timeout warning, jsonata-validity check on
  Group by, tooltips on every label, an **Open example flows**
  shortcut, and an **Advanced** collapsible. Field labels renamed
  for clarity.
- **Persist store dropdown** — new `/join-wait/stores` admin route
  exposes the configured context stores; the editor renders a typo-proof
  `<select>`.
- **Smarter `node.status()`** — single-group nodes show progress
  (`2/3 received`); validation / regex-compile / correlator-evaluation
  failures show a red ring with a short reason.
- **Five shipped example flows** — Quickstart, Correlation, Reset,
  Regex, Exact order — discoverable via **Menu → Import → Examples
  → join-wait**.
- **`msg.reset`** silently drains the queue for the current
  correlation group.

### Changed

- **Persistence rewritten on top of Node-RED's context store**,
  replacing the `node-persist` singleton (which raced when multiple
  `join-wait` nodes shared the flow). Default in-memory store keeps
  queues across deploys; a configured persistent store keeps them
  across full restarts. **Preserve queue** defaults to on; the node
  auto-picks the first persistent named store when the default is
  memory.
- **`msg.pathsToWait`, `msg.pathsToExpire`, `msg.useRegex`** are now
  one-shot overrides — they apply only to the current message
  instead of permanently mutating the node's stored config.
- **Expired output uses the configured Path field** for the merged
  data (matched the success output). Previously hardcoded to
  `msg.paths`.
- **Code split** into `lib/config.js`, `lib/matcher.js`,
  `lib/persist.js`; `findAllPaths{AnyOrder,ExactOrder}` return a
  `{matched, keep}` shape; `drainQueue` takes options; internal
  renames for clarity (config keys unchanged for back-compat).
- jsonata bumped to v2 (proper async `evaluate()`); Node-RED ≥ 3.0,
  Node.js ≥ 20.

### Fixed

- `node.error` / `node.warn` correctly pass the originating `msg`
  (previously passed as `[msg, null]` since 0.5.x — Catch nodes
  downstream now receive the real message).
- Close handler always calls `done` even when the context-store
  write rejects, so persistence failures don't hold up shutdown.
- `mapPayload` no longer mutates the caller's `pathTopic` object.
- Possible race when multiple `join-wait` nodes shared the global
  `node-persist` singleton (now an isolated context-store entry per
  node).

### Tooling

- GitHub Actions CI replaces Travis (matrix on Node 20/22/24);
  publish job gated on lint + format + spellcheck + test matrix.
  ESLint v9 (flat config), Prettier v3, c8 (replaces nyc), cspell
  (replaces `markdown-spellcheck`); Dependabot for monthly npm + GHA
  updates. Test suite expanded from 32 to 102 cases.

## [0.5.3] - 2021-10-31

- Update dependencies.

## [0.5.2] - 2021-02-02

- Retain state across restart
  ([#7](https://github.com/dxdc/node-red-contrib-join-wait/issues/7)).

## [0.5.1] - 2021-01-05

- More automated testing and code coverage.

## [0.5.0] - 2020-12-17

- Expire earlier for "any order" mode
  ([#4](https://github.com/dxdc/node-red-contrib-join-wait/issues/4)).

## [0.4.5] - 2020-12-15

- Add automated tests; address several minor issues uncovered by
  testing; refactoring and readability changes.

## [0.4.0] - 2020-12-14

- Reworked logic for exact-order mode
  ([#1](https://github.com/dxdc/node-red-contrib-join-wait/issues/1)).
- Support for duplicate path names
  ([#2](https://github.com/dxdc/node-red-contrib-join-wait/issues/2)).
- Show all unmatched paths with individual warnings.
- Minor changes to config UI and defaults.

## [0.3.5] - 2020-05-26

- Enforce unique path names.
- Regex-based path matching.

## [0.3.4] - 2020-01-17

- Don't reuse the `msg` variable.

## [0.3.3] - 2020-01-17

- Fix bug with paths / `clearTimeout`.
- Minor code optimizations; add Example 3 to documentation.

## [0.3.2] - 2020-01-16

- `msg.complete` handling.
- `timeoutUnits` in settings.
- `ignoreUnmatched` paths option in settings.
- Updated documentation.

## [0.3.0] - 2020-01-14

- Initial release.
