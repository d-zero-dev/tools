import { describe, expect, test } from 'vitest';

import { arrayEditDistance } from './array-edit-distance.js';

describe('arrayEditDistance', () => {
	test('two empty arrays have distance 0', () => {
		expect(arrayEditDistance([], [])).toBe(0);
	});

	test('identical arrays have distance 0', () => {
		expect(
			arrayEditDistance(['body>ul>li', 'body>ul>li'], ['body>ul>li', 'body>ul>li']),
		).toBe(0);
	});

	test('one empty array costs the length of the other (all insertions)', () => {
		expect(arrayEditDistance([], ['a', 'b', 'c'])).toBe(3);
		expect(arrayEditDistance(['a', 'b', 'c'], [])).toBe(3);
	});

	test('reordering the same elements is not free', () => {
		// swapping the first two elements costs 2 substitutions, not 0
		expect(arrayEditDistance(['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(2);
	});

	test('a single substitution costs 1', () => {
		expect(arrayEditDistance(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(1);
	});

	test('a single insertion costs 1', () => {
		expect(arrayEditDistance(['a', 'c'], ['a', 'b', 'c'])).toBe(1);
	});

	test('a single deletion costs 1', () => {
		expect(arrayEditDistance(['a', 'b', 'c'], ['a', 'c'])).toBe(1);
	});

	test('mixed insertions, deletions and substitutions combine', () => {
		expect(arrayEditDistance(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'e', 'd'])).toBe(2);
	});
});
