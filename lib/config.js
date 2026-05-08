'use strict';

// Accept either a real array (new editor format) or a JSON-encoded string
// (legacy editor format). Returns false for anything else so callers can
// detect "not configured".
function normalizePaths(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || value === '') return false;
    try {
        const json = JSON.parse(value);
        return Array.isArray(json) ? json : false;
    } catch (_err) {
        return false;
    }
}

function hasDuplicatePath(arr) {
    return arr.some((p, i) => arr.indexOf(p) !== i);
}

function compileRegex(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map((pattern) => (pattern instanceof RegExp ? pattern : new RegExp(pattern)));
}

module.exports = { normalizePaths, hasDuplicatePath, compileRegex };
