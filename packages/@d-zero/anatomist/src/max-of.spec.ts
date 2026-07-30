import { describe, expect, it } from 'vitest';

import { maxOf } from './max-of.js';

describe('maxOf', () => {
	it('returns 0 for an empty array', () => {
		expect(maxOf([])).toBe(0);
	});

	it('returns the largest value', () => {
		expect(maxOf([3, 1, 4, 1, 5, 9, 2, 6])).toBe(9);
	});

	it('returns the only value for a single-element array', () => {
		expect(maxOf([42])).toBe(42);
	});

	it('does not throw on a very large array (unlike Math.max(...spread))', () => {
		const large = Array.from({ length: 200_000 }, (_, i) => i);
		expect(maxOf(large)).toBe(199_999);
	});
});
