var should = require('should');
var persist = require('../lib/persist');

// In-memory stub that mimics Node-RED's context API. The third arg is the
// store name (ignored here) and the fourth is a (err, value) callback.
function makeStubContext(initial) {
    var data = Object.assign({}, initial || {});
    return {
        get: function (key, store, cb) {
            setImmediate(function () {
                cb(null, data[key]);
            });
        },
        set: function (key, value, store, cb) {
            data[key] = value;
            setImmediate(function () {
                cb(null);
            });
        },
        _data: data,
    };
}

describe('persist adapter', function () {
    it('returns {} when nothing is stored', function () {
        var ctx = makeStubContext();
        return persist.load(ctx).then(function (val) {
            val.should.eql({});
        });
    });

    it('returns the previously stored value', function () {
        var ctx = makeStubContext({ paths: { topic1: { queue: [[1, {}, {}]] } } });
        return persist.load(ctx).then(function (val) {
            val.should.have.property('topic1');
            val.topic1.queue.should.have.length(1);
        });
    });

    it('returns {} for non-object values', function () {
        var ctx = makeStubContext({ paths: 'not-an-object' });
        return persist.load(ctx).then(function (val) {
            val.should.eql({});
        });
    });

    it('round-trips a save then load', function () {
        var ctx = makeStubContext();
        var paths = { topic1: { queue: [[42, { p: 1 }, { path_1: true }]] } };
        return persist
            .save(ctx, undefined, paths)
            .then(function () {
                return persist.load(ctx);
            })
            .then(function (loaded) {
                loaded.should.have.property('topic1');
                loaded.topic1.queue.should.have.length(1);
                loaded.topic1.queue[0][0].should.equal(42);
            });
    });

    it('strips non-serializable timeOut handles when saving', function () {
        var ctx = makeStubContext();
        var paths = { topic1: { queue: [[1, {}, {}]], timeOut: setTimeout(function () {}, 5000) } };
        return persist.save(ctx, undefined, paths).then(function () {
            ctx._data.paths.topic1.should.have.property('queue');
            ctx._data.paths.topic1.should.not.have.property('timeOut');
            clearTimeout(paths.topic1.timeOut);
        });
    });

    it('clears the stored value', function () {
        var ctx = makeStubContext({ paths: { x: 1 } });
        return persist.clear(ctx).then(function () {
            should(ctx._data.paths).be.undefined();
        });
    });
});
