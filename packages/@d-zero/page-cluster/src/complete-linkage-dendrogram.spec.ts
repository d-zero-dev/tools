import { describe, expect, test } from 'vitest';

import {
	completeLinkageDendrogram,
	labelsAtThreshold,
} from './complete-linkage-dendrogram.js';

describe('completeLinkageDendrogram', () => {
	test('empty input returns empty merge list', () => {
		expect(completeLinkageDendrogram([])).toEqual([]);
	});

	test('single item returns empty merge list', () => {
		expect(completeLinkageDendrogram([new Set(['a'])])).toEqual([]);
	});

	test('two identical items produce one merge at height 1', () => {
		const merges = completeLinkageDendrogram([new Set(['a', 'b']), new Set(['a', 'b'])]);
		expect(merges).toHaveLength(1);
		expect(merges[0]?.height).toBe(1);
	});

	test('two disjoint items produce one merge at height 0', () => {
		const merges = completeLinkageDendrogram([new Set(['a']), new Set(['b'])]);
		expect(merges).toHaveLength(1);
		expect(merges[0]?.height).toBe(0);
	});

	test('n items always produce exactly n-1 merges', () => {
		const sets = Array.from({ length: 5 }, (_, i) => new Set([`unique-${i}`]));
		expect(completeLinkageDendrogram(sets)).toHaveLength(4);
	});

	test('survivor index is always less than dead index', () => {
		const merges = completeLinkageDendrogram([
			new Set(['a', 'b']),
			new Set(['b', 'c']),
			new Set(['c', 'd']),
		]);
		for (const m of merges) {
			expect(m.survivor).toBeLessThan(m.dead);
		}
	});

	test('all merge heights are in [0, 1]', () => {
		const merges = completeLinkageDendrogram([
			new Set(['a', 'b', 'c']),
			new Set(['a', 'b']),
			new Set(['x', 'y']),
		]);
		for (const m of merges) {
			expect(m.height).toBeGreaterThanOrEqual(0);
			expect(m.height).toBeLessThanOrEqual(1);
		}
	});

	test('high-similarity pair merges before low-similarity pair', () => {
		// items 0 and 1 share 2/2 tokens (Jaccard=1); item 2 shares none
		const merges = completeLinkageDendrogram([
			new Set(['a', 'b']),
			new Set(['a', 'b']),
			new Set(['x', 'y']),
		]);
		// First merge should be 0-1 at height 1, then that cluster merges with 2 at height 0
		expect(merges[0]?.height).toBe(1);
		expect(merges[1]?.height).toBe(0);
	});
});

describe('labelsAtThreshold', () => {
	test('empty merge list returns each index as its own root', () => {
		expect(labelsAtThreshold(3, [], 0.8)).toEqual([0, 1, 2]);
	});

	test('threshold 0: all items in one cluster', () => {
		const merges = completeLinkageDendrogram([
			new Set(['a']),
			new Set(['b']),
			new Set(['c']),
		]);
		const labels = labelsAtThreshold(3, merges, 0);
		expect(new Set(labels).size).toBe(1);
	});

	test('threshold above all heights: every item is its own singleton', () => {
		// Each item has unique tokens → all Jaccard = 0 → all heights = 0 < 1
		const merges = completeLinkageDendrogram([
			new Set(['a']),
			new Set(['b']),
			new Set(['c']),
		]);
		const labels = labelsAtThreshold(3, merges, 1);
		expect(new Set(labels).size).toBe(3);
	});

	test('identical items merge, disjoint stays separate at threshold 0.8', () => {
		const merges = completeLinkageDendrogram([
			new Set(['a', 'b']),
			new Set(['a', 'b']),
			new Set(['c', 'd']),
		]);
		const labels = labelsAtThreshold(3, merges, 0.8);
		expect(labels[0]).toBe(labels[1]); // identical → merged at height 1
		expect(labels[0]).not.toBe(labels[2]); // disjoint → separate (height 0 < 0.8)
	});

	test('output length matches size parameter', () => {
		const merges = completeLinkageDendrogram([new Set(['a']), new Set(['b'])]);
		expect(labelsAtThreshold(2, merges, 0.5)).toHaveLength(2);
	});
});
