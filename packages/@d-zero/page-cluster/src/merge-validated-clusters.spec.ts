import type { CrossClusterDuplicate } from './find-cross-cluster-duplicates.js';

import { describe, expect, test } from 'vitest';

import { mergeValidatedClusters } from './merge-validated-clusters.js';

/**
 * @param clusterKeyA
 * @param clusterKeyB
 */
function dup(clusterKeyA: string, clusterKeyB: string): CrossClusterDuplicate {
	return { clusterKeyA, clusterKeyB, similarity: 1, corroboratedByMirrorAxis: false };
}

describe('mergeValidatedClusters', () => {
	test('merges two cluster keys into their alphabetically smaller key', () => {
		const result = mergeValidatedClusters(['b', 'a', 'b'], [dup('a', 'b')]);
		expect(result).toEqual(['a', 'a', 'a']);
	});

	test('leaves unrelated cluster keys untouched', () => {
		const result = mergeValidatedClusters(['a', 'b', 'c'], [dup('a', 'b')]);
		expect(result).toEqual(['a', 'a', 'c']);
	});

	test('transitively merges a chain of duplicates', () => {
		const result = mergeValidatedClusters(
			['a', 'b', 'c'],
			[dup('a', 'b'), dup('b', 'c')],
		);
		expect(result).toEqual(['a', 'a', 'a']);
		// same root for all three, regardless of merge order
		expect(new Set(result).size).toBe(1);
	});

	test('empty duplicates list returns the input unchanged', () => {
		const keys = ['a', 'b', 'c'];
		expect(mergeValidatedClusters(keys, [])).toEqual(keys);
	});

	test('is deterministic regardless of duplicate order', () => {
		const keys = ['a', 'b', 'c', 'd'];
		const duplicates = [dup('c', 'd'), dup('a', 'b'), dup('b', 'c')];
		const r1 = mergeValidatedClusters(keys, duplicates);
		const r2 = mergeValidatedClusters(keys, duplicates.toReversed());
		expect(r1).toEqual(r2);
	});

	test('does not merge clusters that share no duplicate entry', () => {
		const result = mergeValidatedClusters(
			['a', 'b', 'c', 'd'],
			[dup('a', 'b'), dup('c', 'd')],
		);
		expect(result).toEqual(['a', 'a', 'c', 'c']);
	});
});
