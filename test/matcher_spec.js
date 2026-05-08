require('should');
var { matchesAny, anyMatches, findAllPathsAnyOrder, findAllPathsExactOrder } = require('../lib/matcher');

describe('matcher', function () {
    describe('matchesAny', function () {
        it('matches against literal strings', function () {
            matchesAny('a', ['a', 'b'], false).should.be.true();
            matchesAny('c', ['a', 'b'], false).should.be.false();
        });

        it('matches against regexes', function () {
            matchesAny('foo', [/^foo$/], true).should.be.true();
            matchesAny('foox', [/^foo$/], true).should.be.false();
        });
    });

    describe('anyMatches', function () {
        it('returns true when any value hits any pattern', function () {
            anyMatches(['x', 'y', 'a'], ['a'], false).should.be.true();
            anyMatches(['x', 'y'], ['a'], false).should.be.false();
        });
    });

    describe('findAllPathsAnyOrder', function () {
        it('returns matched=true when all paths matched', function () {
            findAllPathsAnyOrder([['a'], ['b']], ['a', 'b'], false).should.have.property('matched', true);
        });

        it('returns matched=false with a `keep` count when not yet complete', function () {
            var r = findAllPathsAnyOrder([['a']], ['a', 'b'], false);
            r.should.have.property('matched', false);
            r.should.have.property('keep').which.is.aboveOrEqual(0);
        });

        it('handles repeated wait paths', function () {
            findAllPathsAnyOrder([['a'], ['a'], ['b']], ['a', 'a', 'b'], false).should.have.property('matched', true);
        });
    });

    describe('findAllPathsExactOrder', function () {
        it('returns matched=true when sequence fully matched', function () {
            findAllPathsExactOrder([['a'], ['b'], ['c']], ['a', 'b', 'c'], false).should.have.property('matched', true);
        });

        it('tolerates unexpected paths between expected ones', function () {
            findAllPathsExactOrder([['a'], ['x'], ['b'], ['c']], ['a', 'b', 'c'], false).should.have.property(
                'matched',
                true,
            );
        });

        it('returns matched=false when order is wrong', function () {
            var r = findAllPathsExactOrder([['c'], ['b'], ['a']], ['a', 'b', 'c'], false);
            r.should.have.property('matched', false);
            r.should.have.property('keep').which.is.aboveOrEqual(0);
        });
    });
});
