var os = require('node:os');
var helper = require('node-red-node-test-helper');
helper.init(require.resolve('node-red'), { userDir: os.tmpdir() });

var flows = require('./flows');
var joinWaitNode = require('../join-wait.js');

// Wait for the input handler to have processed an awaited message. The async
// input pipeline yields once for `await node._ready` and again for the
// jsonata path. Two `setImmediate`s + a microtask is plenty.
function flushAsync() {
    return new Promise(function (resolve) {
        setImmediate(function () {
            setImmediate(resolve);
        });
    });
}

describe('wait paths node', function () {
    before(function (done) {
        helper.startServer(done);
    });

    after(function (done) {
        helper.stopServer(done);
    });

    afterEach(function () {
        helper.unload();
    });

    it('should be loaded', function (done) {
        var flow = [{ id: 'n1', type: 'join-wait', name: 'join-wait' }];
        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.should.have.property('name', 'join-wait');
            var logEvents = helper.log().args.filter(function (evt) {
                return evt[0].type == 'join-wait';
            });
            logEvents.should.have.length(0);
            done();
        });
    });

    it('should handle any order flow', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should handle any order flow - jsonata', function (done) {
        var opts = { correlationTopic: 'paths', correlationTopicType: 'jsonata' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should handle any order flow (with expired)', function (done) {
        var opts = { paths: '["path_1", "path_1", "path_2", "path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1' });
                done();
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
        });
    });

    it('should handle any order flow (with expired #2)', function (done) {
        var opts = { paths: '["path_1", "path_1", "path_2", "path_2", "path_3"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload3');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
        });
    });

    it('should handle any order flow (with expired #3)', function (done) {
        var opts = { paths: '["path_1", "path_1", "path_2", "path_2", "path_3"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var counter = 0;

            n3.on('input', function () {
                counter++;
            });
            n2.on('input', function (msg) {
                counter.should.be.eql(1);
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: { path_1: 'payload1', path_2: 'payload2' }, payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
        });
    });

    it('should handle any order flow - 2 correlation topics', function (done) {
        var opts = { correlationTopic: 'group', correlationTopicType: 'msg' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var counter = 0;
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                counter++;
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                if (msg.group === '2') {
                    counter.should.be.eql(2);
                    done();
                }
            });
            n1.receive({ group: '1', paths: 'path_1', payload: 'payload1' });
            n1.receive({ group: '2', paths: 'path_1', payload: 'payload1' });
            n1.receive({ group: '1', paths: 'path_3', payload: 'payload3' });
            n1.receive({ group: '2', paths: 'path_3', payload: 'payload3' });
            n1.receive({ group: '1', paths: 'path_2', payload: 'payload2' });
            n1.receive({ group: '2', paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should handle exact order flow', function (done) {
        var opts = { exactOrder: 'true' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
        });
    });

    it('should handle exact order flow - advanced', function (done) {
        var opts = {
            exactOrder: 'true',
            paths: '["path_1", "path_2", "path_3", "path_1", "path_2", "path_3", "path_2"]',
            timeout: '5',
        };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(1);

                var event = logEvents[0][0];
                event.should.have.property('level', helper.log().WARN);
                event.should.have.property('id', 'n1');
                event.should.have.property('type', 'join-wait');
                event.should.have.property(
                    'msg',
                    'join-wait msg.paths["path_4"] doesn\'t exist in pathsToWait or pathsToExpire!',
                );
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_4', payload: 'payload4' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            setTimeout(function () {
                n1.receive({ paths: 'path_2', payload: 'payload2' });
            }, 1000);
        });
    });

    it('should handle exact order flow - advanced (regex)', function (done) {
        var opts = {
            exactOrder: 'true',
            paths: '["path_1", "path_2", "path_3", "path_1", "path_2", "path_[36]", "path_[24]", "path_3"]',
            timeout: '5',
            useRegex: true,
        };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({
                    path_1: 'payload1',
                    path_2: 'payload2',
                    path_3: 'payload2',
                    path_4: 'payload2',
                    path_5: 'payload2',
                });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });

                logEvents.should.have.length(1);

                var event = logEvents[0][0];
                event.should.have.property('level', helper.log().WARN);
                event.should.have.property('id', 'n1');
                event.should.have.property('type', 'join-wait');
                event.should.have.property(
                    'msg',
                    'join-wait msg.paths["path_5"] doesn\'t exist in pathsToWait or pathsToExpire!',
                );
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: { path_5: 'payload5', path_4: 'payload2', path_3: 'payload3' }, payload: 'payload2' });
            setTimeout(function () {
                n1.receive({ paths: 'path_2', payload: 'payload2' });
            }, 1000);
        });
    });

    it('should handle exact order flow (different pathTopic)', function (done) {
        var opts = { exactOrder: 'true', pathTopic: 'topic' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('topic').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ topic: 'path_1', payload: 'payload1' });
            n1.receive({ topic: 'path_2', payload: 'payload2' });
            n1.receive({ topic: 'path_3', payload: 'payload3' });
        });
    });

    it('should fail exact order flow with duplicates', function (done) {
        var opts = { exactOrder: 'true' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function () {
                counter++;
            });
            n2.on('input', function (msg) {
                counter.should.be.eql(3);
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
        });
    });

    it('should fail exact order flow with duplicates (regex)', function (done) {
        var opts = { exactOrder: 'true', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function () {
                counter++;
            });
            n2.on('input', function (msg) {
                counter.should.be.eql(3);
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
        });
    });

    it('should fail non-exact order flow', function (done) {
        var opts = { exactOrder: 'true' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function () {
                counter++;

                if (counter === 3) {
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(0);
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should handle any order flow (regex), 1 expired', function (done) {
        var opts = { paths: '["path_[12]", "path_3"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var counter = 0;
            n3.on('input', function (msg) {
                counter.should.be.eql(1);
                msg.should.have.property('payload', 'payload3');
                msg.should.have.property('paths').eql({ path_1: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                done();
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload3');
                msg.should.have.property('paths').eql({ path_2: 'payload2', path_3: 'payload3' });
                counter++;
            });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_1', payload: 'payload3' });
        });
    });

    it('should handle exact order flow (regex), 1 expired', function (done) {
        var opts = { exactOrder: 'true', paths: '["path_[12]", "path_3"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var counter = 0;
            n3.on('input', function (msg) {
                counter.should.be.eql(1);
                msg.should.have.property('payload', 'payload3');
                msg.should.have.property('paths').eql({ path_1: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                done();
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload2');
                msg.should.have.property('paths').eql({ path_2: 'payload2', path_3: 'payload3' });
                counter++;
            });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_1', payload: 'payload3' });
        });
    });

    it('should handle exact order flow (regex - set inline), 1 expired', function (done) {
        // msg.useRegex is now a one-shot override (no longer persisted on the node).
        // Each message that should be evaluated as regex must include useRegex:true.
        var opts = { exactOrder: 'true', paths: '["path_[12]", "path_3"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var counter = 0;
            n3.on('input', function (msg) {
                counter.should.be.eql(1);
                msg.should.have.property('payload', 'payload3');
                msg.should.have.property('paths').eql({ path_1: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);

                done();
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload2');
                msg.should.have.property('paths').eql({ path_2: 'payload2', path_3: 'payload3' });
                counter++;
            });
            n1.receive({ paths: 'path_2', useRegex: true, payload: 'payload2' });
            n1.receive({ paths: 'path_3', useRegex: true, payload: 'payload3' });
            n1.receive({ paths: 'path_1', useRegex: true, payload: 'payload3' });
        });
    });

    it('should handle exact order flow (using object)', function (done) {
        var opts = { exactOrder: 'true' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload1', path_3: 'payload1' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: { path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' }, payload: 'payload1' });
        });
    });

    it('should have last topic', function (done) {
        var opts = { firstMsg: 'false' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                msg.should.have.property('payload', 'payload2');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2', path_3: 'payload3' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should expire msg', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
        });
    });

    it('should timeout 2x', function (done) {
        var opts = { timeout: 0.4 };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            var count = 0;
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths');
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                count++;
                if (count == 3) {
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            setTimeout(function () {
                n1.receive({ paths: 'path_1', payload: 'payload1' });
            }, 100);
            setTimeout(function () {
                n1.receive({ paths: 'path_2', payload: 'payload1' });
            }, 500);
        });
    });

    it('should expire with msg.complete', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function (msg) {
                counter++;
                if (msg.payload === 'payload1') {
                    msg.should.have.property('payload', 'payload1');
                    msg.should.have.property('paths').eql({ path_1: 'payload1' });
                } else {
                    msg.should.have.property('payload', 'payload2');
                    msg.should.have.property('paths').eql({ path_2: 'payload2' });
                    counter.should.be.eql(2);
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(0);
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', complete: true, payload: 'payload2' });
        });
    });

    it('should not expire with msg.complete', function (done) {
        var opts = { timeout: 5, disableComplete: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            n3.on('input', function (msg) {
                done(msg);
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', complete: true, payload: 'payload2' });
            setTimeout(function () {
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            }, 1000);
        });
    });

    it('should expire path', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]', mapPayload: false };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function (msg) {
                counter++;
                if (msg.payload === 'payload1') {
                    msg.should.have.property('payload', 'payload1');
                    msg.should.have.property('paths').eql({ path_1: true });
                } else {
                    msg.should.have.property('payload', 'payload2');
                    msg.should.have.property('paths').eql({ path_2: true });
                    counter.should.be.eql(2);
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(0);
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should expire path - regex', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_1"]', mapPayload: false, useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');

            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: true });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
        });
    });

    it('should expire path (same object) - mapped', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payloadX');
                msg.should.have.property('paths').eql({ path_1: 'payloadX', path_2: 'payloadX' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: { path_1: 'payload1', path_2: 'payload2' }, payload: 'payloadX' });
        });
    });

    it('should expire path (same object) - not mapped', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]', mapPayload: false };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload2' });
                var logEvents = helper.log().args.filter(function (evt) {
                    return evt[0].type == 'join-wait';
                });
                logEvents.should.have.length(0);
                done();
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: { path_1: 'payload1', path_2: 'payload2' }, payload: 'payload1' });
        });
    });

    // The persistence load path (read context store on construct, restart timers
    // for stale entries) is exercised via the persistence adapter unit tests
    // in test/persist_spec.js. End-to-end round-trip tests aren't viable with
    // the current `node-red-node-test-helper`, which wipes context on unload.

    it('should expire path - mapped paths', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function (msg) {
                counter++;
                if (msg.payload === 'payload1') {
                    msg.should.have.property('payload', 'payload1');
                    msg.should.have.property('paths').eql({ path_1: 'payload1' });
                } else {
                    msg.should.have.property('payload', 'payload2');
                    msg.should.have.property('paths').eql({ path_2: 'payload2' });
                    counter.should.be.eql(2);
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(0);
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should expire path - not mapped paths', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]', mapPayload: false };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var counter = 0;

            n3.on('input', function (msg) {
                counter++;
                if (msg.payload === 'payload1') {
                    msg.should.have.property('payload', 'payload1');
                    msg.should.have.property('paths').eql({ path_1: true });
                } else {
                    msg.should.have.property('payload', 'payload2');
                    msg.should.have.property('paths').eql({ path_2: true });
                    counter.should.be.eql(2);
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(0);
                    done();
                }
            });
            n2.on('input', function (msg) {
                done(msg);
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
        });
    });

    it('should warn unknown path', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: { missing1: false, missing2: true }, payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().WARN);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait msg.paths["missing1"], msg.paths["missing2"] doesn\'t exist in pathsToWait or pathsToExpire!',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail jsonata correlationTopic', function (done) {
        var opts = { correlationTopic: '${', correlationTopicType: 'jsonata' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait.invalid-expr topic Expected ":" before end of expression',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail jsonata correlationTopic (inline error)', function (done) {
        var opts = { correlationTopic: '$notafunction()', correlationTopicType: 'jsonata' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property('msg', 'join-wait.invalid-expr topic Attempted to invoke a non-function');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail duplicate expire paths', function (done) {
        var opts = { pathsToExpire: '["path_1", "path_1"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait pathsToExpire cannot have duplicate entries: path_1,path_1',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail duplicate expire paths (set inline)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', pathsToExpire: ['path_1', 'path_1'], payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait pathsToExpire cannot have duplicate entries: path_1,path_1',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid path (array)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: ['badpath'], payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait "msg.paths" must be a string or an object, e.g., msg.paths = \'value\'.',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid path (integer)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 5, payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait "msg.paths" must be a string or an object, e.g., msg.paths = \'value\'.',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail empty path', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: '', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property('msg', 'join-wait "msg.paths" is undefined or not set.');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail no pathTopic', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];
                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property('msg', 'join-wait "msg.paths" is undefined or not set.');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid pathsToWait (regex)', function (done) {
        var opts = { paths: '["path_[1", "path_2", "path_3"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait.regex-expr Invalid regular expression: /path_[1/: Unterminated character class',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid pathsToExpire (regex)', function (done) {
        var opts = { pathsToExpire: '["path_[1"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property(
                        'msg',
                        'join-wait.regex-expr Invalid regular expression: /path_[1/: Unterminated character class',
                    );
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid pathsToWait (supplied command line)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', pathsToWait: [], payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property('msg', 'join-wait pathsToWait must be a defined array.');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should fail invalid pathsToExpire (supplied command line)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', pathsToExpire: [], payload: 'payload1' });

            flushAsync().then(function () {
                try {
                    helper.log().called.should.be.true();
                    var logEvents = helper.log().args.filter(function (evt) {
                        return evt[0].type == 'join-wait';
                    });
                    logEvents.should.have.length(1);

                    var msg = logEvents[0][0];

                    msg.should.have.property('level', helper.log().ERROR);
                    msg.should.have.property('id', 'n1');
                    msg.should.have.property('type', 'join-wait');
                    msg.should.have.property('msg', 'join-wait pathsToExpire must be undefined or an array.');
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    it('should clear the queue on msg.reset without sending output', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            var fired = false;

            n2.on('input', function () {
                fired = true;
            });
            n3.on('input', function () {
                fired = true;
            });

            n1.receive({ paths: 'path_1', payload: 'p1' });
            n1.receive({ paths: 'path_2', payload: 'p2' });
            // queue now has [path_1, path_2]; reset should drop both with no output
            n1.receive({ paths: 'path_1', reset: true, payload: 'reset' });

            setTimeout(function () {
                fired.should.be.false();
                Object.keys(n1.queues).length.should.equal(0);
                done();
            }, 50);
        });
    });

    it('should treat msg.useRegex as a one-shot override', function (done) {
        var opts = { paths: '["path_1", "path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            // Send a regex match with useRegex:true (matches path_1), then a literal that wouldn't
            // match if useRegex stuck around globally for subsequent messages.
            n2.on('input', function (msg) {
                msg.should.have.property('paths').eql({ path_1: 'a', path_2: 'b' });
                n1.useRegex.should.be.false();
                done();
            });
            n1.receive({ paths: 'path_1', useRegex: true, payload: 'a' });
            n1.receive({ paths: 'path_2', payload: 'b' });
        });
    });

    it('should treat msg.pathsToWait as a one-shot override', function (done) {
        var opts = { paths: '["path_1", "path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            // Override pathsToWait on first message; subsequent message uses node-level config.
            n1.receive({ paths: 'foo', pathsToWait: ['foo'], payload: 'a' });
            // node-level pathsToWait is unchanged
            JSON.stringify(n1.pathsToWait).should.equal('["path_1","path_2"]');
            done();
        });
    });

    it('should not mutate a passed pathTopic object when mapPayload is on', function (done) {
        var opts = { mapPayload: 'true' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var sharedPaths = { path_1: 'original' };
            n1.receive({ paths: sharedPaths, payload: 'overwritten' });
            // The caller's object should NOT have been mutated
            sharedPaths.path_1.should.equal('original');
            done();
        });
    });

    it('should report progress (n/m received) via node.status()', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var statuses = [];
            // Wrap status to capture calls
            var origStatus = n1.status;
            n1.status = function (s) {
                statuses.push(s);
                origStatus.call(n1, s);
            };
            n1.receive({ paths: 'path_1', payload: 'a' });
            n1.receive({ paths: 'path_2', payload: 'b' });
            setTimeout(function () {
                var hasProgress = statuses.some(function (s) {
                    return s && s.text && /\d+\/\d+ received/.test(s.text);
                });
                hasProgress.should.be.true();
                done();
            }, 50);
        });
    });

    it('should populate node.paths on input and clear it after a complete match', function (done) {
        var flow = flows.getDefault({ timeout: '60', timeoutUnits: '1000' });

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            n2.on('input', function () {
                // After a successful merge, the queue for the topic should be cleared.
                Object.keys(n1.queues).length.should.equal(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'a' });
            n1.receive({ paths: 'path_2', payload: 'b' });
            flushAsync().then(function () {
                Object.keys(n1.queues).length.should.equal(1);
                n1.receive({ paths: 'path_3', payload: 'c' });
            });
        });
    });

    it('should fail invalid pathsToExpire (non-array, non-string config)', function (done) {
        var opts = { pathsToExpire: '{"not":"array"}' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            // pathsToExpire JSON parses but isn't an array → normalizePaths returns false
            // No error from constructor; sending input still works using node.pathsToWait
            n1.receive({ paths: 'path_1', payload: 'a' });
            setTimeout(done, 30);
        });
    });
});
