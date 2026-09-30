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

	test('keeps only classes in allowedClasses when the set is given', () => {
		expect(
			parseClassList('outline grid card', true, new Set(['card', 'grid'])),
		).toStrictEqual(['card', 'grid']);
	});

	test('applies allowedClasses after the noise filter, so an allow-listed noise class stays out', () => {
		expect(
			parseClassList('card sc-bdVaJa', true, new Set(['card', 'sc-bdVaJa'])),
		).toStrictEqual(['card']);
		expect(
			parseClassList('card sc-bdVaJa', false, new Set(['card', 'sc-bdVaJa'])),
		).toStrictEqual(['card', 'sc-bdVaJa']);
	});

	test('an empty allowedClasses set drops every class', () => {
		expect(parseClassList('a b', true, new Set())).toStrictEqual([]);
	});
});
