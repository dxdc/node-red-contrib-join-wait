# node-red-contrib-join-wait

[![CI](https://github.com/dxdc/node-red-contrib-join-wait/actions/workflows/ci.yml/badge.svg)](https://github.com/dxdc/node-red-contrib-join-wait/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/node-red-contrib-join-wait.svg)](https://www.npmjs.com/package/node-red-contrib-join-wait)
[![npm downloads](https://img.shields.io/npm/dt/node-red-contrib-join-wait.svg)](https://www.npmjs.com/package/node-red-contrib-join-wait)
[![license](https://img.shields.io/npm/l/node-red-contrib-join-wait.svg)](LICENSE)

A Node-RED node that joins related messages across multiple paths within a
time window — with exact-order matching, regex paths, correlation grouping,
reset paths, and queue persistence. Coordinate parallel flows, synchronize
events, and debounce sensors.

If all the named paths arrive in time, a merged message is emitted on the
**success** output. Anything left over goes to the **expired** output for
optional follow-up.

## Use cases

- **Debounce a motion sensor** when a light turning on/off is also tripping
  it: only fire if `light_off` then `motion` then `light_on` all arrive
  within 10 s.
- **Correlate request lifecycle events** — wait for `request_started` and
  `request_finished` with the same correlation id and emit one log entry
  with the duration.
- **Sensor consensus** — only act when both `door_open` and `vibration`
  fire within 2 s.
- **Recombine fanned-out API calls** — join the responses from a
  `split` flow when each branch tags its result with a known path name.
- **Watchdog gate** — let `start` plus N progress beats arrive within a
  window, otherwise route to an alarm flow via the expired output.

## Is this the right node? `join-wait` vs. the stock `join` node

| You need to…                                           | Stock `join` | `join-wait` |
| ------------------------------------------------------ | :----------: | :---------: |
| Recombine pieces of a `split` message (`msg.parts`)    |      ✅      |      –      |
| Concatenate strings, arrays, or buffers                |      ✅      |      –      |
| Count "any N messages" into a batch                    |      ✅      |      –      |
| Wait for **specific named** paths within a time window |      –       |     ✅      |
| Match path names by regex                              |      –       |     ✅      |
| Require an **exact order** (with repeats)              |      –       |     ✅      |
| Drain the queue when a "reset" path arrives            |      –       |     ✅      |
| Group by an arbitrary correlation expression           |      –       |     ✅      |

**Rule of thumb:** if you split a message and want to put it back
together, use the stock `join`. If you have heterogeneous events from
different sources and want to coordinate them, use `join-wait`.

## Quick start

```sh
cd ~/.node-red
npm install node-red-contrib-join-wait
```

Or search **`join-wait`** in **Manage palette → Install**.

Open the editor, drag a `join-wait` node onto a flow, and add the path names
you want to wait for. That's it.

> Looking for a working flow? After install, open
> **Menu → Import → Examples → join-wait** for ready-made flows.

> **Tip:** in the **Wait paths** / **Reset paths** lists you can press
> <kbd>Enter</kbd> in a row to add the next one, and paste newline-separated
> text into any row to fill the current row and append the rest as new
> rows — handy for seeding a list from a spreadsheet column or a debug log.

## How it works

```
              ┌──────────────┐
input  ───►   │   join-wait  │  ───► (1) success — merged msg
              └──────────────┘  ───► (2) expired — anything that didn't make it
```

Every incoming message tells the node which path it represents (via a
configurable message property — `msg.topic` by default). The node holds onto
each one until either:

- **All wait paths arrive within the timeout** → forwards a single merged
  message on output 1.
- **The timeout elapses, or a reset path is seen, or `msg.complete` is set**
  → forwards whatever's queued to output 2.

## Configuration

| Field            | What it controls                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Path field**   | The `msg` property whose value names the path. Default `msg.topic`. Can be a string or an object of paths.  |
| **Wait paths**   | The path names to wait for. Repeating an entry means "this path must arrive that many times".               |
| **Timeout**      | Window for all wait paths to arrive.                                                                        |
| **Match order**  | `Any order` (default) or `Exact order`.                                                                     |
| **Group by**     | Optional — only joins messages whose value at this property matches. Use `msg._msgid` for split-flow joins. |
| **Output base**  | Use the first or last received message as the base of the merged output.                                    |
| **Merge values** | Keep original path values, or overwrite each with that message's `msg.payload`.                             |

### Advanced

| Field               | What it controls                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Reset paths**     | Path names that immediately drain the queue to the expired output. Each must be unique.      |
| **Use regex**       | Treat each path entry as a regular expression.                                               |
| **Unmatched paths** | Log a warning when a message arrives with a path not in either list.                         |
| **Ignore complete** | Disable the `msg.complete` short-circuit.                                                    |
| **Preserve queue**  | Keep the queue across deploys and (with a configured store) restarts.                        |
| **Persist store**   | Name of a context store from `settings.js` (e.g. `localfilesystem`) for restart persistence. |

### Per-message overrides

Any of these on an incoming message change behavior for **that message only**
(no node-level state is persisted):

- `msg.pathsToWait` — array overriding **Wait paths**.
- `msg.pathsToExpire` — array overriding **Reset paths**.
- `msg.useRegex` — boolean overriding **Use regex**.
- `msg.complete` — drains the queue to the expired output.
- `msg.reset` (boolean `true`) — silently drains the queue, no output.

### Path field as a string vs. object

```js
// As a string — one path per message
msg.topic = 'path_1';

// As an object — one message represents multiple paths
msg.topic = { path_1: true, path_2: true };

// As an object — values are kept in the merged output (when "Merge values"
// is set to keep original)
msg.topic = { path_1: { sensor: 'A' }, path_2: { sensor: 'B' } };
```

## Behavior reference

- When the same wait path arrives more than required, only the latest value
  is kept in the merged output.
- In **Exact order** mode, unexpected paths between expected ones are
  tolerated.
- In any-order mode with regex, paths are counted greedily left-to-right.
  `["path_[12]", "path_2"]` will never complete because every `path_2`
  arrival gets attributed to the first regex.
- Pad **Timeout** with a small overhead (~5–10 ms) when working with very
  short windows — evaluation isn't free.
- The success output reuses the chosen base message (first or last) and
  attaches the merged data on the **Path field** property.

## Persistence

Queues live in [Node-RED's context store](https://nodered.org/docs/user-guide/context).
**Preserve queue** is on by default, so partial joins survive a redeploy
out of the box (the default in-memory store keeps state in-process).

To survive **full Node-RED restarts**, configure a persistent context
store in `settings.js`. The simplest setup:

```js
contextStorage: {
    default: { module: 'localfilesystem' },
}
```

Every `join-wait` node then uses the default store automatically.

If you have a mixed setup with `memory` as the default and a separate
persistent store (e.g. for archival), `join-wait` is smart about it:
when `Preserve queue` is on but the default store is memory, the node
**auto-picks** the first non-memory named store and logs which one it
chose. So this configuration also gets restart persistence for free:

```js
contextStorage: {
    default: { module: 'memory' },
    file:    { module: 'localfilesystem' },  // auto-picked
}
```

Set **Persist store** explicitly on a node to override the auto-pick.

## Example flows

After install, **Menu → Import → Examples → join-wait** lists ready-made
flows:

1.  **Quickstart** — wait for two paths within 5 s.
2.  **Correlation** — group messages from a split flow via `_msgid`.
3.  **Reset paths** — abort the queue when a reset path arrives.
4.  **Regex paths** — match path names by regular expression.
5.  **Exact order** — require a specific sequence (with a repeated step).

## Compatibility

- Node-RED 3.x and 4.x.
- Node.js 20 / 22 / 24.

## Migrating from 0.5.x

Version 0.6 is mostly drop-in compatible, with two intentional behavior
tweaks:

- `msg.pathsToWait`, `msg.pathsToExpire`, and `msg.useRegex` are now
  **one-shot** overrides — they affect only the current message and no
  longer mutate the node's stored config.
- Persistence moved from a `node-persist` singleton to Node-RED's context
  store (fixes a multi-node race). For restart persistence, configure a
  persistent store in `settings.js` and set **Persist store**.

The configuration field for paths now stores a real array; the legacy JSON
string form (`'["a","b"]'`) is still accepted at runtime so existing flows
keep working without re-deploying.

See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

## Contributing

Issues and PRs welcome — please run `npm test`, `npm run lint`, and
`npm run spellcheck` locally before sending.

## Support this project

If this project saved you time and you'd like to send a tip:

- [![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/ddcaspi) — one-time PayPal donations.
- **Venmo** — one-time donations via Venmo:

    ![Venmo QR](docs/venmo.png?raw=true 'Venmo QR Code')

A GitHub star also goes a long way.

## License

MIT — see [LICENSE](LICENSE).

## Credits

Originally inspired by [mauriciom75/node-red-contrib-wait-paths](https://github.com/mauriciom75/node-red-contrib-wait-paths).
