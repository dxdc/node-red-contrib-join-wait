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
});
