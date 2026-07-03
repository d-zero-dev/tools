import { describe, expect, test } from 'vitest';

import { jaccardSimilarity } from './jaccard-similarity.js';

describe('jaccardSimilarity', () => {
	test('identical sets return 1', () => {
		const a = new Set(['body>ul>li', 'body>.card', 'body>.card>img']);
		const b = new Set(['body>ul>li', 'body>.card', 'body>.card>img']);
		expect(jaccardSimilarity(a, b)).toBe(1);
	});

	test('disjoint sets return 0', () => {
		const a = new Set(['body>ul>li']);
		const b = new Set(['body>.card']);
		expect(jaccardSimilarity(a, b)).toBe(0);
	});

	test('partial overlap returns intersection over union', () => {
		const a = new Set(['a', 'b', 'c']);
		const b = new Set(['b', 'c', 'd']);
		// intersection = {b, c} = 2, union = {a, b, c, d} = 4
		expect(jaccardSimilarity(a, b)).toBe(0.5);
	});

	test('one empty set returns 0', () => {
		const a = new Set(['a']);
		const b = new Set();
		expect(jaccardSimilarity(a, b)).toBe(0);
		expect(jaccardSimilarity(b, a)).toBe(0);
	});

	test('both empty sets return 1', () => {
		expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
	});

	test('result is symmetric and correct when set sizes differ', () => {
		const small = new Set(['a', 'b']);
		const large = new Set(['a', 'b', 'c', 'd', 'e']);
		// intersection = {a, b} = 2, union = {a, b, c, d, e} = 5
		expect(jaccardSimilarity(small, large)).toBe(0.4);
		expect(jaccardSimilarity(large, small)).toBe(0.4);
	});
});
