import { test, expect } from 'vitest';

import { removeMatches } from './remove-matches.js';

test('removeMatches', () => {
	expect(removeMatches('abc', 'abc')).toStrictEqual(['', '']);
	expect(removeMatches('abc', 'abd')).toStrictEqual(['c', 'd']);
	expect(removeMatches('abc', 'def')).toStrictEqual(['abc', 'def']);
	expect(removeMatches('abc1', 'abc2')).toStrictEqual(['1', '2']);
	expect(removeMatches('abc01', 'abc02')).toStrictEqual(['1', '2']);
	expect(removeMatches('a', 'abc')).toStrictEqual(['', 'bc']);
	expect(removeMatches('abc', 'ab')).toStrictEqual(['c', '']);
});
