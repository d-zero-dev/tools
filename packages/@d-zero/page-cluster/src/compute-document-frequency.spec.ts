import { describe, expect, test } from 'vitest';

import { computeDocumentFrequency } from './compute-document-frequency.js';

describe('computeDocumentFrequency', () => {
	test('empty input returns an empty map and a page count of 0', () => {
		expect(computeDocumentFrequency([])).toEqual({
			documentFrequency: new Map(),
			pageCount: 0,
		});
	});

	test('pageCount reflects the number of token sets passed in', () => {
		const sets = [new Set(['a']), new Set(['b']), new Set(['c'])];
		expect(computeDocumentFrequency(sets).pageCount).toBe(3);
	});

	test('a token present in every set gets a count equal to the set count', () => {
		const sets = [
			new Set(['body>header>a']),
			new Set(['body>header>a']),
			new Set(['body>header>a']),
		];
		expect(computeDocumentFrequency(sets)).toEqual({
			documentFrequency: new Map([['body>header>a', 3]]),
			pageCount: 3,
		});
	});

	test('a token present in only one set gets a count of 1', () => {
		const sets = [new Set(['body>main>p']), new Set(['body>footer>span'])];
		const { documentFrequency } = computeDocumentFrequency(sets);
		expect(documentFrequency.get('body>main>p')).toBe(1);
		expect(documentFrequency.get('body>footer>span')).toBe(1);
	});

	test('counts multiple distinct tokens independently across overlapping sets', () => {
		const sets = [new Set(['a', 'b']), new Set(['b', 'c']), new Set(['b'])];
		const { documentFrequency } = computeDocumentFrequency(sets);
		expect(documentFrequency.get('a')).toBe(1);
		expect(documentFrequency.get('b')).toBe(3);
		expect(documentFrequency.get('c')).toBe(1);
	});

	test('a single empty set contributes no frequency entries but still counts as one page', () => {
		expect(computeDocumentFrequency([new Set()])).toEqual({
			documentFrequency: new Map(),
			pageCount: 1,
		});
	});
});
