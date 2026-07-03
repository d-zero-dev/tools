import { describe, expect, test } from 'vitest';

import { jaccardSimilarity } from './jaccard-similarity.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';

/**
 * Naive, obviously-correct reference implementation of threshold-cut
 * complete-linkage clustering: repeatedly rescans every live cluster pair
 * and merges the single best (highest minimum-pairwise-similarity) pair,
 * with no NN-chain bookkeeping. Used only to differentially verify the
 * production NN-chain implementation, which computes the exact same
 * clustering faster (O(n²) vs this function's O(n³)) — see
 * resolve-structural-cluster-keys.ts's JSDoc for why NN-chain is a genuine
 * speedup, not an approximation. Returns numeric cluster labels rather than
 * `cluster:N` strings; label *values* are allowed to differ from the
 * production function's own numbering (traversal order differs between the
 * two algorithms), only the partition (which pages end up together) must
 * match, which `samePartition` below checks.
 * @param tokenSets
 * @param threshold
 */
function bruteForceCompleteLinkage(
	tokenSets: readonly ReadonlySet<string>[],
	threshold: number,
): number[] {
	let clusters: number[][] = tokenSets.map((_, index) => [index]);

	for (;;) {
		let bestPair: [number, number] | undefined;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (let i = 0; i < clusters.length; i++) {
			for (let j = i + 1; j < clusters.length; j++) {
				let minSimilarity = Number.POSITIVE_INFINITY;
				for (const p of clusters[i] ?? []) {
					for (const q of clusters[j] ?? []) {
						minSimilarity = Math.min(
							minSimilarity,
							jaccardSimilarity(tokenSets[p] ?? new Set(), tokenSets[q] ?? new Set()),
						);
					}
				}
				if (minSimilarity > bestScore) {
					bestScore = minSimilarity;
					bestPair = [i, j];
				}
			}
		}

		if (!bestPair || bestScore < threshold) {
			break;
		}

		const [i, j] = bestPair;
		clusters[i] = [...(clusters[i] ?? []), ...(clusters[j] ?? [])];
		clusters = clusters.filter((_, index) => index !== j);
	}

	const labels = Array.from({ length: tokenSets.length });
	for (const [clusterIndex, members] of clusters.entries()) {
		for (const member of members) {
			labels[member] = clusterIndex;
		}
	}
	return labels;
}

/**
 * Whether two label arrays (of any label type) describe the same partition
 * — i.e. every pair of positions is grouped together in one array if and
 * only if it is in the other. Deliberately ignores the concrete label
 * values themselves, since two different (but equally valid) clustering
 * algorithms/traversal orders may number the same groups differently.
 * @param a
 * @param b
 */
function samePartition(a: readonly unknown[], b: readonly unknown[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		for (let j = i + 1; j < a.length; j++) {
			if ((a[i] === a[j]) !== (b[i] === b[j])) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Deterministic PRNG (mulberry32) so the property test is reproducible across CI runs.
 * @param seed
 */
function mulberry32(seed: number): () => number {
	let state = seed;
	return () => {
		// `| 0` intentionally wraps to a signed 32-bit integer (mulberry32's
		// overflow behavior); `Math.trunc()` alone would not wrap, so the
		// usual unicorn/prefer-math-trunc autofix would silently change this
		// PRNG's output sequence.
		// eslint-disable-next-line unicorn/prefer-math-trunc
		state = (state + 0x6d_2b_79_f5) | 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * Generates `count` random token sets drawn from a `vocabularySize`-word
 * vocabulary (each word independently included with 50% probability), for
 * the differential property test below.
 * @param seed
 * @param count
 * @param vocabularySize
 */
function randomTokenSets(
	seed: number,
	count: number,
	vocabularySize: number,
): Set<string>[] {
	const random = mulberry32(seed);
	const vocabulary = Array.from(
		{ length: vocabularySize },
		(_, index) => `token-${index}`,
	);
	return Array.from({ length: count }, () => {
		const tokens = vocabulary.filter(() => random() < 0.5);
		return new Set(tokens);
	});
}

describe('resolveStructuralClusterKeys', () => {
	test('an empty array returns an empty array', () => {
		expect(resolveStructuralClusterKeys([])).toEqual([]);
	});

	test('a single token set forms its own cluster', () => {
		const result = resolveStructuralClusterKeys([new Set(['body>header'])]);
		expect(result).toEqual(['cluster:0']);
	});

	test('two identical token sets share a cluster key', () => {
		const a = new Set(['body>header', 'body>main>.card', 'body>footer']);
		const b = new Set(['body>header', 'body>main>.card', 'body>footer']);
		const result = resolveStructuralClusterKeys([a, b]);
		expect(result[0]).toBe(result[1]);
	});

	test('a pair at exactly the default threshold (0.8) still merges', () => {
		// shared = 8 tokens; a/b each add one unique token: intersection = 8,
		// union = 10, similarity = 8/10 = 0.8 (the >= boundary is inclusive)
		const shared = Array.from({ length: 8 }, (_, index) => `shared-${index}`);
		const a = new Set([...shared, 'unique-a']);
		const b = new Set([...shared, 'unique-b']);
		const result = resolveStructuralClusterKeys([a, b]);
		expect(result[0]).toBe(result[1]);
	});

	test('a pair just below the default threshold does not merge', () => {
		// shared = 7 tokens; a/b each add two unique tokens: intersection = 7,
		// union = 11, similarity = 7/11 ≈ 0.636, below the default 0.8
		const shared = Array.from({ length: 7 }, (_, index) => `shared-${index}`);
		const a = new Set([...shared, 'a1', 'a2']);
		const b = new Set([...shared, 'b1', 'b2']);
		const result = resolveStructuralClusterKeys([a, b]);
		expect(result[0]).not.toBe(result[1]);
	});

	test('a threshold assembled from arithmetic (0.1 + 0.2) still merges a pair at the equivalent exact boundary', () => {
		// 0.1 + 0.2 === 0.30000000000000004, not the mathematically equivalent
		// 0.3 — regression test for the floating-point boundary bug found by
		// /code-review xhigh: comparing a pair's exact similarity against this
		// threshold with no epsilon tolerance would wrongly reject a pair the
		// caller intended to be at the (inclusive) boundary.
		// shared = 3, a-only = 4, b-only = 3: intersection = 3, union = 10,
		// similarity = 3/10 = 0.3 exactly
		const a = new Set(['s1', 's2', 's3', 'a1', 'a2', 'a3', 'a4']);
		const b = new Set(['s1', 's2', 's3', 'b1', 'b2', 'b3']);
		const result = resolveStructuralClusterKeys([a, b], {
			similarityThreshold: 0.1 + 0.2,
		});
		expect(result[0]).toBe(result[1]);
	});

	test('similarityThreshold: 0 merges every page into a single cluster, however dissimilar', () => {
		const result = resolveStructuralClusterKeys(
			[new Set(['a']), new Set(['b']), new Set(['c'])],
			{ similarityThreshold: 0 },
		);
		expect(result[0]).toBe(result[1]);
		expect(result[1]).toBe(result[2]);
	});

	test('similarityThreshold: 1 only merges pages with an identical token set', () => {
		const result = resolveStructuralClusterKeys(
			[new Set(['a', 'b']), new Set(['a', 'b']), new Set(['a', 'b', 'c'])],
			{ similarityThreshold: 1 },
		);
		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('complete-linkage refuses to chain A into C through a shared bridge B', () => {
		// similarity(A,B) = |{a,b}| / |{a,b,c}| = 2/3 ≈ 0.667
		// similarity(B,C) = |{a,c}| / |{a,b,c,d}| = 2/4 = 0.5
		// similarity(A,C) = |{a}| / |{a,b,c,d}| = 1/4 = 0.25
		// With threshold 0.5: A-B and B-C both clear it, but A-C does not.
		// Single-linkage/connected-components would merge all three via B;
		// complete-linkage must not, because {A,B,C} would require every pair
		// (including A-C) to clear the threshold.
		const a = new Set(['a', 'b']);
		const b = new Set(['a', 'b', 'c']);
		const c = new Set(['a', 'c', 'd']);
		const result = resolveStructuralClusterKeys([a, b, c], { similarityThreshold: 0.5 });

		expect(result[0]).toBe(result[1]);
		expect(result[2]).not.toBe(result[0]);
	});

	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with resolveStructuralClusterKeys's @example: if this
		// ever fails, the JSDoc example is out of date and must be corrected
		// alongside the implementation, not the other way around.
		const result = resolveStructuralClusterKeys([
			new Set(['body>header', 'body>main>.card', 'body>footer']),
			new Set(['body>header', 'body>main>.card', 'body>footer']),
			new Set(['body>nav', 'body>main>form']),
		]);
		expect(result).toEqual(['cluster:0', 'cluster:0', 'cluster:1']);
	});

	test('three mutually dissimilar token sets each form their own cluster', () => {
		const result = resolveStructuralClusterKeys([
			new Set(['body>header']),
			new Set(['body>nav', 'body>main>form']),
			new Set(['body>aside', 'body>footer', 'body>footer>small']),
		]);
		expect(new Set(result).size).toBe(3);
	});

	test.each([-0.1, 1.1, Number.NaN])(
		'rejects a similarityThreshold outside [0, 1] (%s)',
		(similarityThreshold) => {
			expect(() => resolveStructuralClusterKeys([], { similarityThreshold })).toThrow(
				RangeError,
			);
		},
	);

	test.each([0, 1])(
		'accepts the boundary similarityThreshold values (%s)',
		(similarityThreshold) => {
			expect(() =>
				resolveStructuralClusterKeys([], { similarityThreshold }),
			).not.toThrow();
		},
	);

	const propertyTestCases = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((seed) =>
		[4, 6, 10].flatMap((vocabularySize) =>
			[0.3, 0.5, 0.8].map(
				(threshold) => [seed, vocabularySize, threshold] as [number, number, number],
			),
		),
	);

	test.each(propertyTestCases)(
		'matches a naive brute-force complete-linkage reference on random inputs (seed %s, vocabulary %s, threshold %s)',
		(seed, vocabularySize, threshold) => {
			const tokenSets = randomTokenSets(seed, 8, vocabularySize);

			const actual = resolveStructuralClusterKeys(tokenSets, {
				similarityThreshold: threshold,
			});
			const expected = bruteForceCompleteLinkage(tokenSets, threshold);

			expect(samePartition(actual, expected)).toBe(true);
		},
	);
});
