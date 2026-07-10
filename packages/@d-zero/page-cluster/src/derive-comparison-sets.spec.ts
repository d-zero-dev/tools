import { describe, expect, test } from 'vitest';

import { deriveComparisonSets } from './derive-comparison-sets.js';

describe('deriveComparisonSets', () => {
	test('fewer than 10 pages returns the exact same array reference (no filtering)', () => {
		const tokenSets = Array.from({ length: 9 }, (_, i) => new Set([`token-${i}`]));
		expect(deriveComparisonSets(tokenSets)).toBe(tokenSets);
	});

	test('at 10 pages, tokens present in all pages are removed as chrome', () => {
		// 'common' appears in all 10 pages → frequency 10/10 → chrome → stripped
		// each 'page-N' appears only once → content → kept
		const tokenSets = Array.from(
			{ length: 10 },
			(_, i) => new Set(['common', `page-${i}`]),
		);
		const result = deriveComparisonSets(tokenSets);
		expect(result[0]).toEqual(new Set(['page-0']));
		expect(result[9]).toEqual(new Set(['page-9']));
	});

	test('falls back to original token set when all tokens resolve to chrome', () => {
		// every page has only 'shared-only' → frequency 10/10 → chrome
		// contentTokens = {} (size 0), tokens.size > 0 → fallback to original set
		const tokenSets = Array.from({ length: 10 }, () => new Set(['shared-only']));
		const result = deriveComparisonSets(tokenSets);
		expect(result[0]).toEqual(new Set(['shared-only']));
	});
});
