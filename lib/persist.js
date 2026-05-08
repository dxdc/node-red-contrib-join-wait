'use strict';

// Persistence adapter over Node-RED's context store API. Production code
// passes `node.context()` (or any object exposing `get/set` with the
// callback signature). Tests pass an in-memory stub.
//
// Using the context store is the idiomatic Node-RED way:
//  - Default memory store keeps queues across deploys (in-process).
//  - A persistent store configured in settings.js (e.g. localfilesystem)
//    keeps queues across full restarts.
// The store is selected per-instance via the `persistStore` config field.

const KEY = 'paths';

function load(ctx, store) {
    return new Promise((resolve) => {
        try {
            ctx.get(KEY, store, (err, value) => {
                /* c8 ignore next 4 */
                if (err) {
                    resolve({});
                    return;
                }
                resolve(value && typeof value === 'object' ? value : {});
            });
            /* c8 ignore next 3 */
        } catch (_err) {
            resolve({});
        }
    });
}

function save(ctx, store, paths) {
    // Strip non-serializable timeOut handles before writing.
    const serializable = {};
    for (const t of Object.keys(paths)) {
        serializable[t] = { queue: paths[t].queue };
    }
    return new Promise((resolve) => {
        try {
            ctx.set(KEY, serializable, store, () => resolve());
            /* c8 ignore next 3 */
        } catch (_err) {
            resolve();
        }
    });
}

function clear(ctx, store) {
    return new Promise((resolve) => {
        try {
            ctx.set(KEY, undefined, store, () => resolve());
            /* c8 ignore next 3 */
        } catch (_err) {
            resolve();
        }
    });
}

module.exports = { load, save, clear, KEY };
