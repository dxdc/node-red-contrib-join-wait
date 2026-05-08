'use strict';

// Resolves which Node-RED context store the join-wait node should use
// for its queue. Order of preference:
//
//   1. The explicit per-node `Persist store` (config.persistStore).
//   2. If "Preserve queue" is on AND the default store is memory AND
//      there's a non-memory named store, pick that — saves the user
//      from having to set Persist store on every node just to get
//      restart persistence.
//   3. Otherwise undefined (use Node-RED's default store).
//
// The contextStorage entry shape supported by Node-RED:
//   { default: { module: 'memory' }, file: { module: 'localfilesystem' } }
//   { default: 'memoryOnly', memoryOnly: { module: 'memory' }, ... }
//   { default: 'memory' }                     (string shorthand)

// Returns the module string for a contextStorage entry. The entry may itself
// be a module-config object (`{ module: 'memory' }`) or a plain module name
// string (`'memory'`).
function entryModule(entry) {
    if (!entry) return undefined;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') return entry.module;
    /* c8 ignore next */
    return undefined;
}

// `default` may itself be a string alias to another named entry (e.g.
// `default: 'memoryOnly'` referring to a named `memoryOnly` store).
// Follow the alias to find the actual module.
function resolveDefaultModule(contextStorage) {
    const def = contextStorage.default;
    if (!def) return undefined;
    if (typeof def === 'string' && contextStorage[def]) {
        return entryModule(contextStorage[def]);
    }
    return entryModule(def);
}

function resolveContextStore(contextStorage, configStore, persistQueue) {
    if (configStore) return configStore;
    if (!persistQueue) return undefined;
    if (!contextStorage || typeof contextStorage !== 'object') return undefined;

    const defaultModule = resolveDefaultModule(contextStorage);
    // If the default is anything other than memory (or unset → memory) it'll
    // already survive restarts — nothing to upgrade.
    if (defaultModule && defaultModule !== 'memory') return undefined;

    // Look for a persistent named store. Skip the `default` key itself, and
    // any entries whose resolved module is memory.
    const defaultAlias = typeof contextStorage.default === 'string' ? contextStorage.default : undefined;
    for (const name of Object.keys(contextStorage)) {
        if (name === 'default') continue;
        if (name === defaultAlias) continue;
        const m = entryModule(contextStorage[name]);
        if (m && m !== 'memory') return name;
    }

    return undefined;
}

module.exports = { resolveContextStore };
