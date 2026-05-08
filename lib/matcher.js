'use strict';

// Pure path-matching helpers. No node-red dependencies — easy to unit test.

function flatten(arr) {
    return [].concat.apply([], arr);
}

function condenseWithCount(arr) {
    const map = arr.reduce((m, key) => m.set(key, (m.get(key) || 0) + 1), new Map());
    return Array.from(map, ([name, value]) => ({ name, value }));
}

function regexIndexOf(arr, needle) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].test(needle)) return i;
    }
    return -1;
}

function matchesAny(val, patterns, useRegex) {
    return useRegex ? patterns.some((p) => p.test(val)) : patterns.includes(val);
}

function anyMatches(values, patterns, useRegex) {
    return values.some((v) => matchesAny(v, patterns, useRegex));
}

function countPathsAnyOrder(keys, waitMap, useRegex) {
    const used = new Set();
    return waitMap.map((p) => {
        let count = 0;
        for (let i = 0; i < keys.length; i++) {
            if (used.has(i)) continue;
            const matched = useRegex ? p.name.test(keys[i]) : p.name === keys[i];
            if (!matched) continue;
            used.add(i);
            count++;
        }
        return count < p.value ? count : true;
    });
}

// Result shape returned by findAllPaths*:
//   { matched: true }                 — wait paths satisfied; caller drains.
//   { matched: false, keep: <number> }— not yet; caller may expire trailing
//                                       entries past `keep`.
const MATCHED = Object.freeze({ matched: true });

function findAllPathsAnyOrder(arr, waitPaths, useRegex) {
    const waitMap = condenseWithCount(waitPaths);
    const keys = flatten(arr);
    const result = countPathsAnyOrder(keys, waitMap, useRegex);

    if (result.every((p) => p === true)) return MATCHED;

    const originalString = result.toString();
    for (let i = 0; i < arr.length; i++) {
        const newKeys = flatten(arr.slice(i + 1));
        const expireByOne = countPathsAnyOrder(newKeys, waitMap, useRegex);
        if (originalString !== expireByOne.toString()) {
            return { matched: false, keep: arr.length - i };
        }
    }

    /* c8 ignore next */
    return { matched: false, keep: 0 };
}

function findAllPathsExactOrder(arr, waitPaths, useRegex) {
    let start = 0;
    let marker = false;

    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            const p = arr[i][j];

            const offBy = marker === false ? 0 : marker + 1;
            const unusedWaitPaths = waitPaths.slice(offBy);
            let index = useRegex ? regexIndexOf(unusedWaitPaths, p) : unusedWaitPaths.indexOf(p);

            if (index === -1) {
                if (offBy > 0) {
                    index = useRegex ? regexIndexOf(waitPaths, p) : waitPaths.indexOf(p);
                    if (index > 0) marker = false;
                }
            } else {
                index += offBy;
            }

            if (index === 0) {
                start = i;
            } else if (index === -1 || marker === false) {
                continue;
            } else if (index < marker || index > marker + 1) {
                marker = false;
                continue;
            }

            if (index === waitPaths.length - 1) return MATCHED;

            marker = index;
        }
    }

    return { matched: false, keep: marker === false ? 0 : arr.length - start };
}

module.exports = {
    matchesAny,
    anyMatches,
    findAllPathsAnyOrder,
    findAllPathsExactOrder,
};
