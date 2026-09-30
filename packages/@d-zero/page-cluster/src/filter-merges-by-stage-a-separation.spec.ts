import type { StageALineageEntry } from './stage-a-lineage.js';

import { describe, expect, test } from 'vitest';

import {
	filterMergesByStageASeparation,
	MIN_EXCLUSIVE_TOKENS,
} from './filter-merges-by-stage-a-separation.js';

const SHARED = Array.from({ length: 10 }, (_, i) => `body>.shell>s${i}`);

/**
 * Builds a context for two groups `a` and `b` from their core tokens. The
 * class-stripped cores default to the same sets (fine for cases where the
 * shape path is not under test).
 * @param cores
 * @param lineages
 * @param shaped
 */
function contextFor(
	cores: Record<string, readonly string[]>,
	lineages: Record<string, readonly StageALineageEntry[]>,
	shaped: Record<string, readonly string[]> = cores,
) {
	return {
		cores: new Map(Object.entries(cores).map(([k, v]) => [k, new Set(v)])),
		shapedCores: new Map(Object.entries(shaped).map(([k, v]) => [k, new Set(v)])),
		lineageByRoot: new Map(Object.entries(lineages)),
		threshold: 0.8,
		shapeThreshold: 0.9,
	};
}

const separated = {
	a: [{ blockKey: 'b', pageCount: 5 }],
	root: [{ blockKey: 'b', pageCount: 5 }],
};

describe('filterMergesByStageASeparation', () => {
	test('vetoes a merge Stage A separated when each core keeps at least MIN_EXCLUSIVE_TOKENS structural tokens of its own', () => {
		expect(MIN_EXCLUSIVE_TOKENS).toBe(2);
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				root: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([]);
	});

	test('keeps a merge when one side has fewer than MIN_EXCLUSIVE_TOKENS structural tokens (conditional render)', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1'],
				root: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('keeps a merge when the root side has fewer than MIN_EXCLUSIVE_TOKENS structural tokens', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				root: [...SHARED, 'body>.shell>detail>y1'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('a vetoed proposal is not remembered as a member of the root', () => {
		// `x` is vetoed against `root`. `y` has exactly root's core (nothing to
		// veto against `root`) but Stage A separated it from `x` as well; if the
		// vetoed `x` were counted as a member of `root`, `y` would be refused.
		const block = [{ blockKey: 'b', pageCount: 5 }];
		const rootTokens = [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'];
		const context = contextFor(
			{
				root: rootTokens,
				x: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				y: rootTokens,
			},
			{ root: block, x: block, y: block },
		);
		expect(
			filterMergesByStageASeparation(
				[
					['x', 'root'],
					['y', 'root'],
				],
				context,
			),
		).toStrictEqual([['y', 'root']]);
	});

	test('the outcome depends on proposal order: whichever separated group is accepted first keeps the other out', () => {
		// Same groups as the previous test with the proposals reversed: `c` is
		// accepted first (nothing separates it from root `a`), so `b`, which
		// Stage A kept apart from `c`, is refused.
		const c = { blockKey: 'news', pageCount: 5 };
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>opt>p1', 'body>.shell>opt>p2'],
				b: [...SHARED, 'body>.shell>opt>p1', 'body>.shell>opt>p2'],
				c: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			{ a: [{ blockKey: 'other', pageCount: 5 }], b: [c], c: [c] },
		);
		expect(
			filterMergesByStageASeparation(
				[
					['c', 'a'],
					['b', 'a'],
				],
				context,
			),
		).toStrictEqual([['c', 'a']]);
	});

	test('a pair exactly at the raw threshold is not exempt, one exactly at the shape threshold is', () => {
		const shared = Array.from({ length: 8 }, (_, i) => `body>.shell>s${i}`);
		// Raw Jaccard is 8 / 12 (8 shared, 2 exclusive per side); the
		// thresholds below are set to exactly the measured ratios.
		const cores = {
			a: [...shared, 'body>.shell>list>x1', 'body>.shell>list>x2'],
			root: [...shared, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
		};
		const rawJaccard = 8 / 12;
		// Class-stripped cores that reach the shape threshold exactly (8 / 10).
		const shaped = {
			a: [...shared, 'body>.shell>x'],
			root: [...shared, 'body>.shell>y'],
		};
		const shapedJaccard = 8 / 10;

		// Raw similarity equal to the threshold is "already similar": not
		// exempt, even though the class-stripped cores would qualify.
		const atRaw = {
			...contextFor(cores, separated, shaped),
			threshold: rawJaccard,
			shapeThreshold: shapedJaccard,
		};
		expect(filterMergesByStageASeparation([['a', 'root']], atRaw)).toStrictEqual([]);

		// One step below the raw threshold, shaped similarity equal to its
		// threshold qualifies for the exemption.
		const belowRaw = { ...atRaw, threshold: rawJaccard + 0.01 };
		expect(filterMergesByStageASeparation([['a', 'root']], belowRaw)).toStrictEqual([
			['a', 'root'],
		]);

		// One step above the shape threshold it does not.
		const aboveShape = { ...belowRaw, shapeThreshold: shapedJaccard + 0.01 };
		expect(filterMergesByStageASeparation([['a', 'root']], aboveShape)).toStrictEqual([]);
	});

	test('a token without any `>` has an empty parent path, which no token of a nested core shares', () => {
		const context = contextFor(
			{
				a: ['x1', 'x2'],
				root: ['body>y1', 'body>y2'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([]);
	});

	test('a group missing from the cores map falls back to an empty core and is not vetoed', () => {
		const context = contextFor({ a: [...SHARED] }, separated);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('keeps a merge whose exclusive tokens all sit under a container the other core also renders (component state variants)', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>pager>current', 'body>.shell>pager>next'],
				root: [...SHARED, 'body>.shell>pager>prev', 'body>.shell>pager>first'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('keeps a merge when Stage A did not separate the groups (different blocks)', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				root: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			{ a: [{ blockKey: 'b1', pageCount: 5 }], root: [{ blockKey: 'b2', pageCount: 5 }] },
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('keeps a merge when either group has no lineage at all', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				root: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			{ root: [{ blockKey: 'b', pageCount: 5 }] },
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('exempts a class-name-only difference: raw cores far apart, class-stripped cores the same skeleton', () => {
		const context = contextFor(
			{
				a: [
					'body>main>section.c-reports>ul.c-reports__list>li',
					'body>main>section.c-reports>ul.c-reports__list>a',
				],
				root: [
					'body>main>section.c-projects>ul.c-projects__list>li',
					'body>main>section.c-projects>ul.c-projects__list>a',
				],
			},
			separated,
			{
				a: ['body>main>section>ul>li', 'body>main>section>ul>a'],
				root: ['body>main>section>ul>li', 'body>main>section>ul>a'],
			},
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([
			['a', 'root'],
		]);
	});

	test('does not exempt a pair that is already similar on raw tokens even if it is also similar class-stripped', () => {
		// 20 shared tokens + 2 exclusive each → raw Jaccard 20/24 ≈ 0.83, above
		// the 0.8 threshold: the exemption is for pairs that only look alike
		// once class names are stripped, not for pairs that already match.
		const shared = Array.from({ length: 20 }, (_, i) => `body>.shell>s${i}`);
		const context = contextFor(
			{
				a: [...shared, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				root: [...shared, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			separated,
		);
		expect(filterMergesByStageASeparation([['a', 'root']], context)).toStrictEqual([]);
	});

	test('checks a proposal against groups already accepted into the same root, not only the root', () => {
		// `c` is only allowed next to root `a` by the union-find (both are
		// close to `b`); but Stage A kept `c` apart from `b`, so once `b` is
		// accepted into `a`, `c` must be refused.
		const c = { blockKey: 'news', pageCount: 5 };
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>opt>p1', 'body>.shell>opt>p2'],
				b: [...SHARED, 'body>.shell>opt>p1', 'body>.shell>opt>p2'],
				c: [...SHARED, 'body>.shell>detail>y1', 'body>.shell>detail>y2'],
			},
			{
				a: [{ blockKey: 'other', pageCount: 5 }],
				b: [c],
				c: [c],
			},
		);
		expect(
			filterMergesByStageASeparation(
				[
					['b', 'a'],
					['c', 'a'],
				],
				context,
			),
		).toStrictEqual([['b', 'a']]);
	});

	test('filters each proposal independently and preserves order', () => {
		const context = contextFor(
			{
				a: [...SHARED, 'body>.shell>list>x1', 'body>.shell>list>x2'],
				b: [...SHARED, 'body>.shell>pager>current', 'body>.shell>pager>next'],
				root: [
					...SHARED,
					'body>.shell>detail>y1',
					'body>.shell>detail>y2',
					'body>.shell>pager>prev',
					'body>.shell>pager>first',
				],
			},
			{ a: separated.a, b: separated.a, root: separated.root },
		);
		expect(
			filterMergesByStageASeparation(
				[
					['a', 'root'],
					['b', 'root'],
				],
				context,
			),
		).toStrictEqual([['b', 'root']]);
	});
});
