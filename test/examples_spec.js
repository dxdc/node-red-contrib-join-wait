// End-to-end smoke test: load each shipped example flow into the helper,
// assert the join-wait node initialises, and run the canonical happy-path
// through it. Catches config-shape regressions between the editor schema
// (defaults block in join-wait.html) and the runtime node.

var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var helper = require('node-red-node-test-helper');
helper.init(require.resolve('node-red'), { userDir: os.tmpdir() });

var joinWaitNode = require('../join-wait.js');

function loadExample(name) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', name), 'utf8'));
}

// Replace any `inject`/`change`/`debug`/`delay` nodes with helper passthroughs
// so we can drive paths and observe outputs directly.
function adaptFlowForHelper(flow, joinWaitId, successId, expiredId) {
    var rewritten = [];
    for (var i = 0; i < flow.length; i++) {
        var n = flow[i];
        if (n.id === joinWaitId) {
            n.wires = [[successId], [expiredId]];
            rewritten.push(n);
        } else if (n.type === 'tab') {
            // strip; helper doesn't need the tab
        } else if (n.id === successId || n.id === expiredId) {
            rewritten.push({ id: n.id, type: 'helper' });
        }
    }
    rewritten.push({ id: successId, type: 'helper' });
    rewritten.push({ id: expiredId, type: 'helper' });
    // de-dupe
    var seen = {};
    return rewritten.filter(function (n) {
        if (seen[n.id]) return false;
        seen[n.id] = true;
        return true;
    });
}

describe('shipped examples', function () {
    before(function (done) {
        helper.startServer(done);
    });

    after(function (done) {
        helper.stopServer(done);
    });

    afterEach(function () {
        return helper.unload();
    });

    it('01-quickstart loads and merges path_1 + path_2', function (done) {
        var flow = adaptFlowForHelper(loadExample('01-quickstart.json'), 'qs-jw', 'qs-success', 'qs-expired');
        helper.load(joinWaitNode, flow, function () {
            var jw = helper.getNode('qs-jw');
            var success = helper.getNode('qs-success');
            jw.should.have.property('pathsToWait').eql(['path_1', 'path_2']);
            success.on('input', function (msg) {
                msg.should.have.property('topic');
                msg.topic.should.have.property('path_1');
                msg.topic.should.have.property('path_2');
                done();
            });
            jw.receive({ topic: 'path_1', payload: 'a' });
            jw.receive({ topic: 'path_2', payload: 'b' });
        });
    });

    it('02-correlation groups messages by _msgid', function (done) {
        var flow = adaptFlowForHelper(loadExample('02-correlation.json'), 'corr-jw', 'corr-ok', 'corr-bad');
        helper.load(joinWaitNode, flow, function () {
            var jw = helper.getNode('corr-jw');
            var ok = helper.getNode('corr-ok');
            jw.should.have.property('correlator', '_msgid');
            ok.on('input', function (msg) {
                msg.topic.should.have.property('path_1');
                msg.topic.should.have.property('path_2');
                msg.topic.should.have.property('path_3');
                done();
            });
            // Same _msgid for all three so they group together.
            jw.receive({ _msgid: 'g1', topic: 'path_1', payload: 'a' });
            jw.receive({ _msgid: 'g1', topic: 'path_2', payload: 'b' });
            jw.receive({ _msgid: 'g1', topic: 'path_3', payload: 'c' });
        });
    });

    it('03-reset drains the queue when an abort path arrives', function (done) {
        var flow = adaptFlowForHelper(loadExample('03-reset.json'), 'rst-jw', 'rst-success', 'rst-expired');
        helper.load(joinWaitNode, flow, function () {
            var jw = helper.getNode('rst-jw');
            var expired = helper.getNode('rst-expired');
            jw.should.have.property('pathsToExpire').eql(['abort']);
            expired.on('input', function (msg) {
                msg.topic.should.have.property('abort');
                done();
            });
            jw.receive({ topic: 'path_1', payload: 'a' });
            jw.receive({ topic: 'abort', payload: 'cancel' });
        });
    });

    it('04-regex matches by regular expression', function (done) {
        var flow = adaptFlowForHelper(loadExample('04-regex.json'), 'rx-jw', 'rx-success', 'rx-expired');
        helper.load(joinWaitNode, flow, function () {
            var jw = helper.getNode('rx-jw');
            var success = helper.getNode('rx-success');
            jw.should.have.property('useRegex', true);
            success.on('input', function (msg) {
                msg.topic.should.have.property('sensor_b');
                msg.topic.should.have.property('heartbeat');
                done();
            });
            jw.receive({ topic: 'sensor_b', payload: 7 });
            jw.receive({ topic: 'heartbeat', payload: 'ok' });
        });
    });

    it('05-exact-order requires the precise sequence', function (done) {
        var flow = adaptFlowForHelper(loadExample('05-exact-order.json'), 'eo-jw', 'eo-success', 'eo-expired');
        helper.load(joinWaitNode, flow, function () {
            var jw = helper.getNode('eo-jw');
            var success = helper.getNode('eo-success');
            jw.should.have.property('exactOrder', true);
            jw.should.have.property('pathsToWait').eql(['start', 'work', 'work', 'end']);
            success.on('input', function (msg) {
                msg.topic.should.have.property('start');
                msg.topic.should.have.property('work');
                msg.topic.should.have.property('end');
                done();
            });
            jw.receive({ topic: 'start', payload: 1 });
            jw.receive({ topic: 'work', payload: 2 });
            jw.receive({ topic: 'work', payload: 3 });
            jw.receive({ topic: 'end', payload: 4 });
        });
    });
});
