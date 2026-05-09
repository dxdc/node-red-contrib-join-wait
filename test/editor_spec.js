// Static sanity check on the editor HTML. We don't try to fully execute
// jQuery + RED.* in a fake DOM here — that's brittle. Instead we assert
// the registerType `defaults` block exposes the same field names the
// runtime expects from `config`. Catches drift in either direction.

var fs = require('node:fs');
var path = require('node:path');
var should = require('should');

describe('editor HTML', function () {
    var html = fs.readFileSync(path.join(__dirname, '..', 'join-wait.html'), 'utf8');

    it('declares a defaults block for every config field the runtime reads', function () {
        // Names the runtime reads from `config` (sourced from join-wait.js).
        var runtimeFields = [
            'name',
            'paths',
            'pathsToExpire',
            'useRegex',
            'warnUnmatched',
            'pathTopic',
            'pathTopicType',
            'correlationTopic',
            'correlationTopicType',
            'timeout',
            'timeoutUnits',
            'exactOrder',
            'firstMsg',
            'mapPayload',
            'disableComplete',
            'persistOnRestart',
            'persistStore',
        ];

        // Crude but sufficient: each field name must appear with a key+colon
        // inside the registerType defaults block.
        runtimeFields.forEach(function (name) {
            var pattern = new RegExp('\\b' + name + '\\s*:\\s*\\{');
            html.should.match(pattern);
        });
    });

    it('defines templates for the help and editor', function () {
        html.should.match(/data-template-name="join-wait"/);
        html.should.match(/data-help-name="join-wait"/);
    });

    it('declares two outputs and labels them', function () {
        html.should.match(/outputs:\s*2/);
        html.should.match(/outputLabels:\s*\['success',\s*'expired'\]/);
    });

    it('uses editableList containers (not raw JSON-string inputs) for paths', function () {
        html.should.match(/node-input-paths-container/);
        html.should.match(/node-input-pathsToExpire-container/);
        html.should.match(/\.editableList\(/);
    });

    it('does not contain the historical empty-bold-tag bug', function () {
        html.should.not.match(/<b>\s*<\/b>/);
    });

    it('does not reference the legacy ignoreUnmatched field', function () {
        should(html).not.match(/ignoreUnmatched/);
    });

    it('renders the persist store as a <select>, not a free-text input', function () {
        html.should.match(/<select id="node-input-persistStore"/);
    });

    it('exposes mount points for the output preview, timeout hint, and examples button', function () {
        html.should.match(/id="join-wait-output-preview"/);
        html.should.match(/id="join-wait-timeout-hint"/);
        html.should.match(/id="join-wait-open-examples"/);
    });

    it('binds Enter inside an editableList row to add the next', function () {
        html.should.match(/keydown[\s\S]*?Enter/);
    });

    it('runs jsonata-style validation on the correlation expression', function () {
        html.should.match(/correlationValidator/);
    });

    it('puts a title attribute on each labelled form row', function () {
        // Spot-check a handful of fields.
        ['pathTopic', 'timeout', 'exactOrder', 'correlationTopic'].forEach(function (id) {
            var pattern = new RegExp('for="node-input-' + id + '"[^>]*title=');
            html.should.match(pattern);
        });
    });

    describe('help text', function () {
        // Carve out just the data-help-name script so drift checks ignore
        // the editor template (which does legitimately reference some
        // legacy paths via back-compat code).
        var helpMatch = html.match(/data-help-name="join-wait">([\s\S]*?)<\/script>/);
        var helpBody = helpMatch && helpMatch[1];

        it('isolates a help template', function () {
            should(helpBody).be.a.String().and.not.be.empty();
        });

        it('does not reference removed/legacy config keys or paths', function () {
            // Each entry was either renamed, removed, or never existed
            // and would mislead a reader of the help text.
            //
            // - ignoreUnmatched: renamed to warnUnmatched (pre-0.6).
            // - {userDir}/join-wait/: file-based persistence path that
            //   was removed when 0.6 moved persistence to the context
            //   store. Regression fence for the 0.6.2 stale-help fix.
            // - node-persist: the dependency removed in 0.6.
            ['ignoreUnmatched', '{userDir}/join-wait/', 'node-persist'].forEach(function (legacy) {
                var pattern = new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                helpBody.should.not.match(pattern);
            });
        });

        it('mentions the context store as the persistence backend', function () {
            // 0.6 moved persistence to RED context; the help should say so.
            helpBody.should.match(/context/i);
        });
    });

    it('uses RED.settings.apiRootUrl when calling the admin route', function () {
        // The bare relative URL works in default setups but breaks under
        // a custom httpAdminRoot or reverse proxy. Regression fence.
        html.should.match(/apiRootUrl[\s\S]*?join-wait\/stores/);
    });

    it('exposes a bulk-paste handler on editableList rows', function () {
        // Pasting newline-separated text into a row splits across rows.
        html.should.match(/input\.on\(['"]paste['"]/);
    });

    it('cross-validates Wait paths and Reset paths', function () {
        // validateAllRows runs after every change so duplicate-in-Reset
        // and overlap-with-Wait warnings stay in sync.
        html.should.match(/function validateAllRows/);
    });
});
