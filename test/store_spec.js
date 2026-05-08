require('should');
var { resolveContextStore } = require('../lib/store');

describe('resolveContextStore', function () {
    it('returns the explicit override when set', function () {
        var cfg = { default: { module: 'memory' }, file: { module: 'localfilesystem' } };
        resolveContextStore(cfg, 'file', true).should.equal('file');
    });

    it('returns undefined when persistQueue is off', function () {
        var cfg = { default: { module: 'memory' }, file: { module: 'localfilesystem' } };
        (resolveContextStore(cfg, undefined, false) === undefined).should.be.true();
    });

    it('returns undefined when contextStorage is unset', function () {
        (resolveContextStore(undefined, undefined, true) === undefined).should.be.true();
    });

    it('auto-picks a persistent store when default is memory', function () {
        var cfg = { default: { module: 'memory' }, file: { module: 'localfilesystem' } };
        resolveContextStore(cfg, undefined, true).should.equal('file');
    });

    it('handles string-shorthand default that aliases a memory entry', function () {
        var cfg = {
            default: 'memoryOnly',
            memoryOnly: { module: 'memory' },
            disk: { module: 'localfilesystem' },
        };
        resolveContextStore(cfg, undefined, true).should.equal('disk');
    });

    it('returns undefined when no persistent store is configured', function () {
        var cfg = { default: { module: 'memory' } };
        (resolveContextStore(cfg, undefined, true) === undefined).should.be.true();
    });

    it('does not override a non-memory default', function () {
        var cfg = { default: { module: 'localfilesystem' }, mem: { module: 'memory' } };
        (resolveContextStore(cfg, undefined, true) === undefined).should.be.true();
    });

    it('handles string-shorthand entries', function () {
        var cfg = { default: 'memory', file: 'localfilesystem' };
        resolveContextStore(cfg, undefined, true).should.equal('file');
    });

    it('skips memory-aliased named entries when scanning for persistent ones', function () {
        var cfg = {
            default: { module: 'memory' },
            mem2: { module: 'memory' },
            disk: { module: 'localfilesystem' },
        };
        resolveContextStore(cfg, undefined, true).should.equal('disk');
    });
});
