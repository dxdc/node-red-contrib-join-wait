// Admin endpoint behind the Persist store dropdown. Surfaces the
// configured context stores to the editor so users pick from a typo-proof
// <select> rather than a free-text field. Added in 0.6.0; previously
// untested.

var should = require('should');
var helper = require('node-red-node-test-helper');
var joinWaitNode = require('../join-wait.js');

helper.init(require.resolve('node-red'));

describe('/join-wait/stores admin endpoint', function () {
    before(function (done) {
        helper.startServer(done);
    });

    after(function (done) {
        helper.stopServer(done);
    });

    afterEach(function () {
        return helper.unload();
    });

    function loadWithSettings(settings, cb) {
        // helper.load only takes (node, flow, credentials, cb); user
        // settings live on a separate helper.settings() call.
        helper.settings(settings);
        helper.load(joinWaitNode, [], cb);
    }

    it('returns the configured context stores keyed by name', function (done) {
        loadWithSettings(
            {
                contextStorage: {
                    default: { module: 'memory' },
                    file: { module: 'localfilesystem' },
                },
            },
            function () {
                helper
                    .request()
                    .get('/join-wait/stores')
                    .expect(200)
                    .expect('Content-Type', /json/)
                    .end(function (err, res) {
                        if (err) return done(err);
                        res.body.should.be.an.Array();
                        var byName = {};
                        res.body.forEach(function (s) {
                            byName[s.name] = s.module;
                        });
                        byName.should.have.property('default', 'memory');
                        byName.should.have.property('file', 'localfilesystem');
                        done();
                    });
            },
        );
    });

    it('returns an empty array when no contextStorage is configured', function (done) {
        loadWithSettings({}, function () {
            helper
                .request()
                .get('/join-wait/stores')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    res.body.should.eql([]);
                    done();
                });
        });
    });

    it('handles string-form context storage entries', function (done) {
        // Node-RED accepts both `{module: 'memory'}` and a bare 'memory'
        // string; the endpoint should normalize either to a `module`
        // property so the editor can render a consistent label.
        loadWithSettings({ contextStorage: { default: 'memory' } }, function () {
            helper
                .request()
                .get('/join-wait/stores')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    var defaultStore = res.body.find(function (s) {
                        return s.name === 'default';
                    });
                    should.exist(defaultStore);
                    defaultStore.should.have.property('module', 'memory');
                    done();
                });
        });
    });

    it('emits a `module: null` shape for entries without a recognisable module', function (done) {
        // Defensive: an oddly-shaped entry shouldn't crash the route or
        // poison the editor dropdown.
        loadWithSettings({ contextStorage: { weird: { somethingElse: true } } }, function () {
            helper
                .request()
                .get('/join-wait/stores')
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    var weird = res.body.find(function (s) {
                        return s.name === 'weird';
                    });
                    should.exist(weird);
                    weird.should.have.property('module', null);
                    done();
                });
        });
    });
});
