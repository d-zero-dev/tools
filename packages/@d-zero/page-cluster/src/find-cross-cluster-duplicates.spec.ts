import type { MirrorAxis } from './detect-mirror-axis.js';
import type { ClusteredPage } from './find-cross-cluster-duplicates.js';

import { describe, expect, test } from 'vitest';

import { findCrossClusterDuplicates } from './find-cross-cluster-duplicates.js';

const axis: MirrorAxis = { position: 0, values: new Set(['en', 'zh']) };

/**
 * @param overrides
 */
function page(overrides: Partial<ClusteredPage>): ClusteredPage {
	return {
		clusterKey: 'k',
		tokens: new Set(),
		paths: [],
		stylesheetHrefs: [],
		...overrides,
	};
}

describe('findCrossClusterDuplicates', () => {
	test('finds an exact-match pair across clusters with no axis required', () => {
		const tokens = new Set(['body>main>.faq', 'body>main>.faq>dl']);
		const pages = [page({ clusterKey: 'a', tokens }), page({ clusterKey: 'b', tokens })];
		const [dup] = findCrossClusterDuplicates(pages);
		expect(dup).toEqual({
			clusterKeyA: 'a',
			clusterKeyB: 'b',
			similarity: 1,
			corroboratedByMirrorAxis: false,
		});
	});

	test('does not report a pair within the same cluster', () => {
		const tokens = new Set(['x']);
		const pages = [page({ clusterKey: 'a', tokens }), page({ clusterKey: 'a', tokens })];
		expect(findCrossClusterDuplicates(pages)).toEqual([]);
	});

	test('excludes pages with an empty token set from exact-match detection', () => {
		const pages = [
			page({ clusterKey: 'a', tokens: new Set() }),
			page({ clusterKey: 'b', tokens: new Set() }),
		];
		expect(findCrossClusterDuplicates(pages)).toEqual([]);
	});

	test('does not find a near-duplicate pair when no mirrorAxis is supplied', () => {
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
			}),
			page({
				clusterKey: 'b',
				tokens: new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x']),
			}),
		];
		expect(findCrossClusterDuplicates(pages)).toEqual([]);
	});

	test('finds a near-duplicate pair when axis+href corroboration both hold', () => {
		// 9 shared tokens + 1 page-specific token each → 9/11 ≈ 0.818,
		// above the default 0.8 corroboration threshold.
		const shared = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set([...shared, 'only-a']),
				paths: ['en', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/en/faq/page.css'],
			}),
			page({
				clusterKey: 'b',
				tokens: new Set([...shared, 'only-b']),
				paths: ['zh', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/zh/faq/page.css'],
			}),
		];
		const [dup] = findCrossClusterDuplicates(pages, { mirrorAxis: axis });
		expect(dup?.corroboratedByMirrorAxis).toBe(true);
		expect(dup?.similarity).toBeCloseTo(9 / 11);
	});

	test('rejects a near-duplicate pair below the similarity threshold even with matching shape and hrefs', () => {
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set(['a', 'b']),
				paths: ['en', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/en/faq/page.css'],
			}),
			page({
				clusterKey: 'b',
				tokens: new Set(['c', 'd']),
				paths: ['zh', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/zh/faq/page.css'],
			}),
		];
		expect(findCrossClusterDuplicates(pages, { mirrorAxis: axis })).toEqual([]);
	});

	test('rejects a high-similarity pair whose hrefs do not corroborate under the axis', () => {
		const shared = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set([...shared, 'only-a']),
				paths: ['en', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/en/faq/page.css'],
			}),
			page({
				clusterKey: 'b',
				tokens: new Set([...shared, 'only-b']),
				paths: ['zh', 'faq', 'index.html'],
				// Unrelated href — does not normalize to the same shape.
				stylesheetHrefs: ['https://example.test/other/unrelated.css'],
			}),
		];
		expect(findCrossClusterDuplicates(pages, { mirrorAxis: axis })).toEqual([]);
	});

	test('same-shape pages that happen to be in the same cluster are not reported', () => {
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set(['a', 'b']),
				paths: ['en', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/en/faq/page.css'],
			}),
			page({
				clusterKey: 'a',
				tokens: new Set(['a', 'b']),
				paths: ['zh', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/zh/faq/page.css'],
			}),
		];
		expect(findCrossClusterDuplicates(pages, { mirrorAxis: axis })).toEqual([]);
	});

	test('orders clusterKeyA/clusterKeyB alphabetically regardless of input order', () => {
		const tokens = new Set(['x']);
		const pages = [
			page({ clusterKey: 'zzz', tokens }),
			page({ clusterKey: 'aaa', tokens }),
		];
		const [dup] = findCrossClusterDuplicates(pages);
		expect(dup?.clusterKeyA).toBe('aaa');
		expect(dup?.clusterKeyB).toBe('zzz');
	});

	test('deduplicates to one entry per cluster pair, keeping the highest similarity found', () => {
		const pages = [
			page({ clusterKey: 'a', tokens: new Set(['x', 'y']) }),
			page({ clusterKey: 'b', tokens: new Set(['x', 'y']) }),
			page({ clusterKey: 'a', tokens: new Set(['x', 'y']) }),
			page({ clusterKey: 'b', tokens: new Set(['x', 'y']) }),
		];
		const duplicates = findCrossClusterDuplicates(pages);
		expect(duplicates).toHaveLength(1);
		expect(duplicates[0]!.similarity).toBe(1);
	});

	test('respects a custom corroboratedSimilarityThreshold', () => {
		const pages = [
			page({
				clusterKey: 'a',
				tokens: new Set(['a', 'b', 'c', 'd']),
				paths: ['en', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/en/faq/page.css'],
			}),
			page({
				clusterKey: 'b',
				tokens: new Set(['a', 'b', 'x', 'y']),
				paths: ['zh', 'faq', 'index.html'],
				stylesheetHrefs: ['https://example.test/zh/faq/page.css'],
			}),
		];
		// similarity = 2/6 ≈ 0.333
		expect(
			findCrossClusterDuplicates(pages, {
				mirrorAxis: axis,
				corroboratedSimilarityThreshold: 0.9,
			}),
		).toEqual([]);
		expect(
			findCrossClusterDuplicates(pages, {
				mirrorAxis: axis,
				corroboratedSimilarityThreshold: 0.3,
			}),
		).toHaveLength(1);
	});
});
