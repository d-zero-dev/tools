import { test, expect } from 'vitest';

import { dirComparator } from './dir.js';

test('dirComparator', () => {
	expect(dirComparator([], [])).toBe(0);
	expect(dirComparator(['b'], ['a'])).toBe(1);
	expect(dirComparator(['a', 'b'], ['b', 'a'])).toBe(-1);
	expect(dirComparator(['a', 'a'], ['a', 'b'])).toBe(-1);
	expect(dirComparator(['a', 'b'], ['a', 'a'])).toBe(1);
	expect(dirComparator(['a', 'a2'], ['a', 'a1'])).toBe(1);
	expect(dirComparator(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toBe(-1);
	expect(dirComparator(['a', 'b', 'c', 'd'], ['a', 'b'])).toBe(1);
	expect(dirComparator(['a', 'b', 'index'], ['a', 'b'])).toBe(1);
	expect(dirComparator(['a', 'b', 'index'], ['a', 'b', 'c'])).toBe(-1);
	expect(dirComparator(['a', 'b', 'index'], ['a', 'b', ''])).toBe(1);
	expect(dirComparator(['a'], [])).toBe(1);
	expect(dirComparator(['a', 'b'], ['a', 'b', 'c'])).toBe(-1);
	expect(dirComparator(['a', 'b'], ['a', 'b', ''])).toBe(-1);
	expect(dirComparator(['a'], ['index', ''])).toBe(-1);
	expect(dirComparator(['', 'a'], ['', 'index', ''])).toBe(-1);
});
