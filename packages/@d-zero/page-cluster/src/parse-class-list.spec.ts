import { describe, expect, test } from 'vitest';

import { parseClassList } from './parse-class-list.js';

describe('parseClassList', () => {
	test('returns [] for undefined/empty', () => {
		expect(parseClassList(undefined, true)).toStrictEqual([]);
		expect(parseClassList('', true)).toStrictEqual([]);
		expect(parseClassList('   ', true)).toStrictEqual([]);
	});

	test('sorts case-insensitively', () => {
		expect(parseClassList('zeta alpha Beta', true)).toStrictEqual([
			'alpha',
			'Beta',
			'zeta',
		]);
	});

	test('deduplicates repeated class tokens', () => {
		expect(parseClassList('foo foo bar', true)).toStrictEqual(['bar', 'foo']);
	});

	test('filters noise classes by default', () => {
		expect(parseClassList('card sc-bdVaJa featured', true)).toStrictEqual([
			'card',
			'featured',
		]);
	});

	test('keeps noise-like classes when filtering is disabled', () => {
		expect(parseClassList('card sc-bdVaJa', false)).toStrictEqual(['card', 'sc-bdVaJa']);
	});

	test('treats an all-noise class attribute as empty once filtered', () => {
		expect(parseClassList('sc-bdVaJa', true)).toStrictEqual([]);
	});
});
