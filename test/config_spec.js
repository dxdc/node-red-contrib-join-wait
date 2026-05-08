var should = require('should');
var { normalizePaths, hasDuplicatePath, compileRegex } = require('../lib/config');

describe('config helpers', function () {
    describe('normalizePaths', function () {
        it('passes arrays through', function () {
            normalizePaths(['a', 'b']).should.eql(['a', 'b']);
        });

        it('parses JSON strings', function () {
            normalizePaths('["a","b"]').should.eql(['a', 'b']);
        });

        it('returns false for empty string', function () {
            normalizePaths('').should.be.false();
        });

        it('returns false for invalid JSON', function () {
            normalizePaths('not-json').should.be.false();
        });

        it('returns false for non-array JSON', function () {
            normalizePaths('{"x":1}').should.be.false();
        });

        it('returns false for non-string non-array', function () {
            normalizePaths(123).should.be.false();
            normalizePaths(null).should.be.false();
            normalizePaths(undefined).should.be.false();
        });
    });

    describe('hasDuplicatePath', function () {
        it('detects duplicates', function () {
            hasDuplicatePath(['a', 'b', 'a']).should.be.true();
        });

        it('returns false for unique entries', function () {
            hasDuplicatePath(['a', 'b', 'c']).should.be.false();
        });

        it('returns false for an empty array', function () {
            hasDuplicatePath([]).should.be.false();
        });
    });

    describe('compileRegex', function () {
        it('compiles strings to regexes', function () {
            var compiled = compileRegex(['^a$', 'b\\d+']);
            compiled[0].test('a').should.be.true();
            compiled[1].test('b42').should.be.true();
            compiled[1].test('b').should.be.false();
        });

        it('passes through existing RegExp instances', function () {
            var rx = /existing/;
            compileRegex([rx])[0].should.equal(rx);
        });

        it('throws on invalid patterns', function () {
            (function () {
                compileRegex(['(unterminated']);
            }).should.throw();
        });

        it('returns non-array input untouched', function () {
            should(compileRegex(false)).equal(false);
        });
    });
});
