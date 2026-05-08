# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-05-08

### Added

- **Modern Node-RED `(msg, send, done)` input handler signature.** The
  runtime now gets a proper `done()` / `done(err)` signal for every
  message — meaningful for async-message tracking and graceful
  shutdown. The async input handler previously relied on auto-completion,
  which fired before any awaited work resolved.
- **Smarter status indicator.** A single-group node shows progress toward
  completion (e.g. `2/3 received`) rather than the raw queue depth.
  Multi-group nodes still show aggregate counts.
- Two more shipped example flows: `04-regex.json` (regex path matching)
  and `05-exact-order.json` (exact-order with a repeated step).
- **Editor UX overhaul.** Wait paths and reset paths now use Node-RED's
  `editableList` widget — add/remove/reorder rows instead of typing JSON
  arrays into a text box. Each row now validates inline (empty / invalid
  regex are flagged red with a tooltip). Pressing <kbd>Enter</kbd> in a
  row adds the next one.
- **Persist store as a dropdown.** A new `/join-wait/stores` admin route
  exposes the configured context stores; the editor populates the
  Persist store field as a `<select>` showing each store's resolved
  module (e.g. `file (localfilesystem)`). Eliminates typos and surfaces
  available stores.
- **Tooltips on every field label.** Hover-discoverable explanations
  (`title` attributes) for every form row.
- **Inline output-shape preview.** Under Wait paths, a small monospace
  line shows what the merged success message looks like
  (`→ msg.topic = { path_1: …, path_2: … }`), updating as the list
  changes.
- **Smart timeout warning.** When the resolved timeout is under 50 ms,
  a yellow tip surfaces the README guidance about padding evaluation
  overhead.
- **Inline jsonata validation on Group by.** When the field type is
  `jsonata`, the expression is parsed at edit-time and the field marks
  invalid before the first message even arrives.
- **Quick "Open example flows" button** in the editor opens the import
  dialog directly.
- Path-row placeholders changed from generic `path name` to a worked
  example (`e.g. sensor_1`, `e.g. abort`) so empty rows hint at intent.
- **Status-indicator error states.** Validation, regex compile, and
  correlator-evaluation failures now show a red ring on the node with a
  short reason in addition to the usual `node.error` log entry.
- **Unhandled-rejection guard** around the async input handler so a future
  bug or upstream throw can't escape without being logged.
- End-to-end smoke test for **all five** shipped example flows, plus a
  static config-shape sanity test on `join-wait.html` to catch drift
  between the editor defaults and the runtime fields.
- **Advanced settings** are collapsed under a single `<details>` group so
  the editor presents the common options first.
- **`msg.reset`** — sending `msg.reset = true` silently drains the queue
  for the current correlation group with no output.
- **`node.status()`** indicator showing the number of queued messages.
- **Examples** — the package now ships three ready-made flows
  (`Quickstart`, `Correlation`, `Reset paths`) discoverable via
  **Menu → Import → Examples → join-wait**.
- **Per-instance persistence store** — new `Persist store` field selects a
  named context store from `settings.js` for restart-survival.
- Unit-test specs for the `lib/config`, `lib/matcher`, and `lib/persist`
  modules.

### Changed

- **Renames for clarity.** Internal-only — config keys and runtime
  behavior are unchanged for existing flows. `node.paths` → `node.queues`;
  `node.topic` / `node.topicType` → `node.correlator` /
  `node.correlatorType`; `node.pathTopic` / `node.pathTopicType` →
  `node.pathField` / `node.pathFieldType`; `node.disableComplete` →
  `node.ignoreMsgComplete`; `node.persistOnRestart` → `node.persistQueue`;
  `node.firstMsg` → `node.useFirstAsBase`. The `clearQueue*` family →
  `dropQueue` / `flushQueueAsExpired` / `flushOnMsgComplete` /
  `flushTimedOutEntries` / `flushTrailingEntries`. Magic
  `'_join-wait-node'` → `DEFAULT_GROUP` constant. `pickArrayOverride` →
  `arrayOrFallback`.
- **`drainQueue` now takes an options object** (`{ sendExpired,
expireByTime, keep }`) instead of three positional booleans + a count.
- **`findAllPaths{AnyOrder,ExactOrder}` return shape** changed from
  `null | number` to `{ matched: true } | { matched: false, keep: number }`
  for self-documenting call sites. Lib functions are not part of the
  public API.
- **`asBool()` helper** accepts both `'true'`/`'false'` strings (from the
  HTML `<select>`) and real booleans (programmatic flow construction).
  Removes a class of subtle defaults-bug for non-editor-built flows.
- **`countPathsAnyOrder`** now uses a `Set` to track used indices
  (O(1) check vs the previous O(n) `Array.indexOf`).
- **Comment around `flushOnMsgComplete`** documents the deliberately
  partial behavior: `msg.complete` short-circuits a partial queue but
  never overrides a successful match.
- **`node:` prefix on core imports** in test files (`node:fs`,
  `node:os`, `node:path`).
- **Expired output now uses the configured `Path field`** for the merged
  data (matching the success output). Previously hardcoded to `msg.paths`
  even when a different `pathTopic` was configured. Existing flows that
  use the default `paths` setting see no change.
- **Persistence rewritten on top of Node-RED's context store** (replacing
  the `node-persist` singleton, which raced when multiple `join-wait` nodes
  were deployed in the same flow). Default in-memory store keeps queues
  across deploys; a configured persistent store keeps them across full
  restarts.
- **`Preserve queue` defaults to on** for new nodes. Partial joins now
  survive a redeploy out of the box. Existing 0.5.x flows keep their
  original `persistOnRestart: false` until re-saved.
- **`Persist store` is no longer required** for restart persistence.
  If `localfilesystem` (or similar) is set as the **default** context
  store in `settings.js`, every join-wait node uses it automatically.
- **Auto-pick of a persistent named store.** When `Preserve queue` is
  on, `Persist store` is empty, and the configured default store is
  memory, the node auto-selects the first non-memory named store from
  `settings.js` (with a `node.log` line so it's discoverable). If the
  user has both `default: memory` and (say) `file: localfilesystem`
  configured, they get restart persistence for free without setting
  `Persist store` on every node. Setting `Persist store` explicitly
  always wins.
- **British → American spellings.** `normalisePaths` → `normalizePaths`,
  `serialisable` → `serializable`, `behaviour` → `behavior` in code +
  docs for consistency with the wider JS / npm ecosystem.
- **`msg.pathsToWait`, `msg.pathsToExpire`, `msg.useRegex` are now one-shot
  overrides** — they apply only to the current message instead of
  permanently mutating the node's stored config.
- **Code split** into `lib/config.js`, `lib/matcher.js`, and `lib/persist.js`
  — `join-wait.js` is now a thin orchestrator. The input handler is broken
  into discrete named phases for readability.
- **`mapPayload` no longer mutates the caller's `pathTopic` object** —
  incoming messages are left untouched.
- **jsonata bumped to v2** (`evaluate()` is now properly awaited).
- **Node-RED bumped to ≥ 3.0**, **Node.js ≥ 18**.
- **`engines.node`, `files`** added to `package.json`; deprecated
  `licenses` array removed.
- Source labels in the editor renamed for clarity:
    - "Paths topic" → **Path field**
    - "Paths (Wait)" / "Paths (Expire)" → **Wait paths** / **Reset paths**
    - "Sequence order" → **Match order**
    - "Base message" → **Output base**
    - "Merged data" → **Merge values**
- README rewritten — quickstart first, technical details after.

### Fixed

- **`node.error` / `node.warn` second argument now correctly passes the
  originating `msg`** (was wrongly passed as `[msg, null]`, a 2-output
  send array, since 0.5.x). Catch nodes downstream now receive the real
  message instead of an array.
- **Close handler always calls `done`**, even when the context-store
  write rejects, so a transient persistence failure can't hold up
  Node-RED shutdown.
- Empty `<b></b>` tag in the help text.
- Stale `ignoreUnmatched` references in older example flows.
- Possible race when multiple `join-wait` nodes shared the global
  `node-persist` singleton (now uses an isolated context-store entry per
  node).

### Tooling

- GitHub Actions CI replaces Travis (matrix on Node 20/22/24, publishing
  on Node 24). CI + release now live in a single workflow; the publish
  job is gated by `needs: [quality, test]` so a tag push only ships once
  lint, format, spellcheck, and the full test matrix have all passed.
- Workflow steps pinned to current `actions/checkout@v6`,
  `actions/setup-node@v6`, `actions/upload-artifact@v6`.
- `prettier --check` enforced in CI to catch unformatted files.
- `engines.node` bumped to `>=20` (Node 18 EOL'd 2025-04-30).
- Automated npm publish workflow with provenance on tag push.
- Dependabot configured for monthly npm + GitHub Actions updates.
- ESLint upgraded to v9 with flat config (`eslint.config.js`).
- Prettier upgraded to v3.
- Coverage moved from `nyc` to `c8` (native V8 coverage).
- Spellcheck moved from the unmaintained `markdown-spellcheck` to `cspell`.
- `node-red-node-test-helper` bumped from 0.2.x to 0.3.6.
- Test suite expanded from 32 to 97 cases — including dedicated specs
  for each `lib/` module, the editor HTML, and end-to-end runs of every
  shipped example flow.

## [0.5.3] and earlier

See the [git log](https://github.com/dxdc/node-red-contrib-join-wait/commits/master).
