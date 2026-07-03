import { describe, expect, test } from 'vitest';

import { splitTokensByFrequency } from './split-tokens-by-frequency.js';

describe('splitTokensByFrequency', () => {
	test('a token at or above the frequency threshold is classified as template', () => {
		const corpusFrequency = {
			documentFrequency: new Map([['body>header>a', 9]]),
			pageCount: 10,
		};
		const result = splitTokensByFrequency(
			new Set(['body>header>a']),
			corpusFrequency,
			0.9,
		);
		expect(result.templateTokens).toEqual(new Set(['body>header>a']));
		expect(result.contentTokens).toEqual(new Set());
	});

	test('a token below the frequency threshold is classified as content', () => {
		const corpusFrequency = {
			documentFrequency: new Map([['body>main>p', 1]]),
			pageCount: 10,
		};
		const result = splitTokensByFrequency(new Set(['body>main>p']), corpusFrequency, 0.9);
		expect(result.templateTokens).toEqual(new Set());
		expect(result.contentTokens).toEqual(new Set(['body>main>p']));
	});

	test('a token missing from the document-frequency map is treated as frequency 0 (content)', () => {
		const corpusFrequency = { documentFrequency: new Map(), pageCount: 10 };
		const result = splitTokensByFrequency(
			new Set(['body>main>unseen']),
			corpusFrequency,
			0.9,
		);
		expect(result.contentTokens).toEqual(new Set(['body>main>unseen']));
		expect(result.templateTokens).toEqual(new Set());
	});

	test('frequency exactly at the threshold counts as template (inclusive boundary)', () => {
		const corpusFrequency = { documentFrequency: new Map([['exact', 9]]), pageCount: 10 };
		const result = splitTokensByFrequency(new Set(['exact']), corpusFrequency, 0.9);
		expect(result.templateTokens).toEqual(new Set(['exact']));
	});

	test('frequency exactly at a threshold that overshoots by floating-point error still counts as template', () => {
		// 0.55 * 100 === 55.00000000000001 in IEEE-754, which would fail a naive
		// `frequency >= threshold * pageCount` check for a token at exactly the
		// documented inclusive boundary
		const corpusFrequency = {
			documentFrequency: new Map([['boundary', 55]]),
			pageCount: 100,
		};
		const result = splitTokensByFrequency(new Set(['boundary']), corpusFrequency, 0.55);
		expect(result.templateTokens).toEqual(new Set(['boundary']));
	});

	test('default threshold is 0.9 when omitted', () => {
		const corpusFrequency = {
			documentFrequency: new Map([['just-below-default', 8]]),
			pageCount: 10,
		};
		const result = splitTokensByFrequency(
			new Set(['just-below-default']),
			corpusFrequency,
		);
		expect(result.contentTokens).toEqual(new Set(['just-below-default']));
		expect(result.templateTokens).toEqual(new Set());
	});

	test('a custom threshold is honored', () => {
		const corpusFrequency = { documentFrequency: new Map([['half', 5]]), pageCount: 10 };
		expect(
			splitTokensByFrequency(new Set(['half']), corpusFrequency, 0.5).templateTokens,
		).toEqual(new Set(['half']));
		expect(
			splitTokensByFrequency(new Set(['half']), corpusFrequency, 0.6).contentTokens,
		).toEqual(new Set(['half']));
	});

	test('an empty token set returns two empty sets', () => {
		const corpusFrequency = { documentFrequency: new Map(), pageCount: 10 };
		const result = splitTokensByFrequency(new Set(), corpusFrequency);
		expect(result.templateTokens).toEqual(new Set());
		expect(result.contentTokens).toEqual(new Set());
	});

	test('a zero-page corpus classifies every token as content (no evidence of repetition)', () => {
		const corpusFrequency = { documentFrequency: new Map(), pageCount: 0 };
		const result = splitTokensByFrequency(new Set(['anything']), corpusFrequency);
		expect(result.contentTokens).toEqual(new Set(['anything']));
		expect(result.templateTokens).toEqual(new Set());
	});

	test('splits a mixed set of high- and low-frequency tokens correctly', () => {
		const corpusFrequency = {
			documentFrequency: new Map([
				['chrome-a', 10],
				['chrome-b', 9],
				['content-a', 2],
				['content-b', 1],
			]),
			pageCount: 10,
		};
		const result = splitTokensByFrequency(
			new Set(['chrome-a', 'chrome-b', 'content-a', 'content-b']),
			corpusFrequency,
			0.9,
		);
		expect(result.templateTokens).toEqual(new Set(['chrome-a', 'chrome-b']));
		expect(result.contentTokens).toEqual(new Set(['content-a', 'content-b']));
	});

	test.each([0, -0.5, 1.5, 90, Number.NaN])(
		'rejects an out-of-range threshold (%s)',
		(threshold) => {
			const corpusFrequency = { documentFrequency: new Map(), pageCount: 10 };
			expect(() =>
				splitTokensByFrequency(new Set(['a']), corpusFrequency, threshold),
			).toThrow(RangeError);
		},
	);

	test('accepts a threshold of exactly 1 (upper boundary is inclusive)', () => {
		const corpusFrequency = {
			documentFrequency: new Map([['always', 10]]),
			pageCount: 10,
		};
		expect(() =>
			splitTokensByFrequency(new Set(['always']), corpusFrequency, 1),
		).not.toThrow();
	});
});
