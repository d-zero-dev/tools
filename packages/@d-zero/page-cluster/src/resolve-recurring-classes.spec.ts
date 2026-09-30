import { describe, expect, test } from 'vitest';

import { resolveRecurringClasses } from './resolve-recurring-classes.js';

describe('resolveRecurringClasses', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		expect(
			resolveRecurringClasses([
				['card', 'grid', 'outline'],
				['card', 'grid', 'weather'],
				['card', 'history'],
			]),
		).toStrictEqual(new Set(['card', 'grid']));
		expect(resolveRecurringClasses([['card'], ['card']])).toStrictEqual(
			new Set(['card']),
		);
	});

	test('returns an empty set for an empty pool (no classes at all)', () => {
		expect(resolveRecurringClasses([])).toStrictEqual(new Set());
		expect(resolveRecurringClasses([[], []])).toStrictEqual(new Set());
	});

	test('a class present on exactly two pages is recurring, one page is not', () => {
		const result = resolveRecurringClasses([['a', 'b'], ['a'], ['c']]);
		expect(result).toStrictEqual(new Set(['a']));
	});

	test('counts pages, not occurrences: a class repeated within one page still counts once', () => {
		expect(resolveRecurringClasses([['dup', 'dup', 'dup'], ['other']])).toStrictEqual(
			new Set(),
		);
	});

	test('a single page makes every class page-unique', () => {
		expect(resolveRecurringClasses([['a', 'b']])).toStrictEqual(new Set());
	});
});
