import { describe, expect, test } from 'vitest';

import {
	areStageASeparated,
	STAGE_A_SEPARATION_MIN_PAGES,
} from './are-stage-a-separated.js';

describe('areStageASeparated', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		expect(
			areStageASeparated(
				[{ blockKey: 'path:news', pageCount: 31 }],
				[{ blockKey: 'path:news', pageCount: 165 }],
			),
		).toBe(true);
		expect(
			areStageASeparated(
				[{ blockKey: 'path:news', pageCount: 1 }],
				[{ blockKey: 'path:news', pageCount: 1 }],
			),
		).toBe(false);
		expect(
			areStageASeparated(
				[{ blockKey: 'path:news', pageCount: 31 }],
				[{ blockKey: 'path:about', pageCount: 165 }],
			),
		).toBe(false);
	});

	test('the page-count floor is exactly STAGE_A_SEPARATION_MIN_PAGES on both sides', () => {
		expect(STAGE_A_SEPARATION_MIN_PAGES).toBe(3);
		const at = { blockKey: 'b', pageCount: 3 };
		const below = { blockKey: 'b', pageCount: 2 };
		expect(areStageASeparated([at], [at])).toBe(true);
		expect(areStageASeparated([at], [below])).toBe(false);
		expect(areStageASeparated([below], [at])).toBe(false);
	});

	test('one qualifying pair anywhere in the two lineages is enough', () => {
		expect(
			areStageASeparated(
				[
					{ blockKey: 'x', pageCount: 1 },
					{ blockKey: 'b', pageCount: 5 },
				],
				[
					{ blockKey: 'y', pageCount: 9 },
					{ blockKey: 'b', pageCount: 4 },
				],
			),
		).toBe(true);
	});

	test('an empty lineage (no block information) is never a separation', () => {
		expect(areStageASeparated([], [{ blockKey: 'b', pageCount: 9 }])).toBe(false);
		expect(areStageASeparated([{ blockKey: 'b', pageCount: 9 }], [])).toBe(false);
		expect(areStageASeparated([], [])).toBe(false);
	});
});
