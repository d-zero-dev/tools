import { describe, test, expect } from 'vitest';

import { alphabeticalComparator } from './alphabetical.js';

describe('alphabeticalComparator', () => {
	test('returns 0 for equal strings', () => {
		expect(alphabeticalComparator('a', 'a')).toBe(0);
	});

	test('orders by code unit', () => {
		expect(alphabeticalComparator('a', 'b')).toBe(-1);
		expect(alphabeticalComparator('b', 'a')).toBe(1);
	});

	test('ignores the case of letters written as-is (not percent-encoded)', () => {
		expect(alphabeticalComparator('a', 'B')).toBe(-1);
		expect(alphabeticalComparator('B', 'a')).toBe(1);
		expect(alphabeticalComparator('ABC', 'abc')).toBe(0);
	});

	test('lowercases the escapes, then compares the decoded form', () => {
		expect(alphabeticalComparator('%E3%81%82', 'あ')).toBe(0);
	});

	test('compares a malformed percent-encoding as-is instead of throwing', () => {
		expect(alphabeticalComparator('%E3', '%e3')).toBe(0);
		expect(alphabeticalComparator('%zz', 'a')).toBe(-1);
	});

	test('sorts an array when passed to Array.prototype.sort', () => {
		expect(['c', 'A', 'b'].toSorted(alphabeticalComparator)).toEqual(['A', 'b', 'c']);
	});
});
