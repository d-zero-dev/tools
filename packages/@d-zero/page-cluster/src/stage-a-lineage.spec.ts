import { describe, expect, test } from 'vitest';

import { initialLineage } from './stage-a-lineage.js';

describe('initialLineage', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		expect(
			initialLineage({ blockKey: 'path:news', memberTokenSets: [new Set(), new Set()] }),
		).toStrictEqual([{ blockKey: 'path:news', pageCount: 2 }]);
		expect(initialLineage({ memberTokenSets: [new Set()] })).toStrictEqual([]);
	});

	test('the page count is the number of member token sets', () => {
		expect(
			initialLineage({
				blockKey: 'b',
				memberTokenSets: [new Set(['a']), new Set(['b']), new Set(['c'])],
			}),
		).toStrictEqual([{ blockKey: 'b', pageCount: 3 }]);
	});
});
