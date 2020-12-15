// var should = require('should');
var helper = require('node-red-node-test-helper');
helper.init(require.resolve('node-red'));

var flows = require('./flows');
var joinWaitNode = require('../join-wait.js');

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
                logEvents.should.have.length(0);
                done();
            });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_1', payload: 'payload1' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
            n1.receive({ paths: 'path_3', payload: 'payload3' });
            n1.receive({ paths: 'path_2', payload: 'payload2' });
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

    it('should expire path (same object) - mapped', function (done) {
        var opts = { paths: '["path_1", "path_3"]', pathsToExpire: '["path_2"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            var n2 = helper.getNode('n2');
            var n3 = helper.getNode('n3');
            n3.on('input', function (msg) {
                msg.should.have.property('payload', 'payload1');
                msg.should.have.property('paths').eql({ path_1: 'payload1', path_2: 'payload1' });
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
                    'join-wait msg.paths["missing1", "missing2"] doesn\'t exist in pathsToWait or pathsToExpire!',
                );
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('should fail duplicate expire paths', function (done) {
        var opts = { pathsToExpire: '["path_1", "path_1"]' };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

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
                msg.should.have.property('msg', 'join-wait pathsToExpire cannot have duplicate entries');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('should fail invalid path (array)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: ['badpath'], payload: 'payload1' });

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

    it('should fail invalid path (integer)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 5, payload: 'payload1' });

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

    it('should fail empty path', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: '', payload: 'payload1' });

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

    it('should fail no pathTopic', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ payload: 'payload1' });

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

    it('should fail invalid pathsToWait (regex)', function (done) {
        var opts = { paths: '["path_[1", "path_2", "path_3"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

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

    it('should fail invalid pathsToExpire (regex)', function (done) {
        var opts = { pathsToExpire: '["path_[1"]', useRegex: true };
        var flow = flows.getDefault(opts);

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', payload: 'payload1' });

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

    it('should fail invalid pathsToWait (supplied command line)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', pathsToWait: [], payload: 'payload1' });

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

    it('should fail invalid pathsToExpire (supplied command line)', function (done) {
        var flow = flows.getDefault();

        helper.load(joinWaitNode, flow, function () {
            var n1 = helper.getNode('n1');
            n1.receive({ paths: 'path_1', pathsToExpire: [], payload: 'payload1' });

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