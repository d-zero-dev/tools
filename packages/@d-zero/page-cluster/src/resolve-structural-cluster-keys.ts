import { jaccardSimilarity } from './jaccard-similarity.js';

/**
 * @see resolveStructuralClusterKeys
 */
export type ResolveStructuralClusterKeysOptions = {
	/**
	 * Minimum `jaccardSimilarity()` score required between *every* pair of
	 * pages within a cluster (complete-linkage criterion) for those pages to
	 * be grouped together. Must be a number in `[0, 1]` (`RangeError`
	 * otherwise). 0.8 is a starting-point heuristic, not validated against
	 * real corpora — tune per site once real cluster boundaries are
	 * inspected.
	 */
	similarityThreshold?: number;
};

const DEFAULT_SIMILARITY_THRESHOLD = 0.8;

/**
 * `jaccardSimilarity()` returns `intersectionSize / unionSize`, a
 * floating-point division that can land a hair below the caller's intended
 * threshold even when the two are mathematically equal (e.g. a threshold
 * assembled from arithmetic like `0.1 + 0.2` is `0.30000000000000004`, not
 * `0.3`), which would otherwise make a pair at the documented inclusive
 * boundary fail the `>=` check it should pass. Subtracting this epsilon
 * before comparing absorbs that rounding noise (same technique and value as
 * `BOUNDARY_EPSILON` in `split-tokens-by-frequency.ts`).
 */
const BOUNDARY_EPSILON = 1e-9;

/**
 * Reads `values[index]`, throwing instead of returning `undefined`. Every
 * call site here indexes within bounds it just established itself (loop
 * ranges, or an index freshly returned by the same array's own scan), so the
 * thrown branch is unreachable in practice; it exists to satisfy
 * `noUncheckedIndexedAccess` without a non-null assertion (same rationale as
 * `readDpValue` in `array-edit-distance.ts`, generalized to any array-like).
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('resolveStructuralClusterKeys: index out of bounds');
	}
	return value;
}

/**
 * Finds the representative (root) of `index`'s set, compressing every
 * traversed link so future lookups on the same path are near-constant time.
 * @param parent
 * @param index
 */
function find(parent: Int32Array, index: number): number {
	let root = index;
	while (requireIndex(parent, root) !== root) {
		root = requireIndex(parent, root);
	}
	let current = index;
	while (current !== root) {
		const next = requireIndex(parent, current);
		parent[current] = root;
		current = next;
	}
	return root;
}

/**
 * Complete-linkage hierarchical clustering of `tokenSets`, cut at
 * `threshold`, computed via the NN-chain algorithm (Murtagh, F., 1983, "A
 * Survey of Recent Advances in Hierarchical Clustering Algorithms," The
 * Computer Journal 26(4)). NN-chain produces the exact same dendrogram as
 * naively re-scanning every live cluster pair for the best merge at each
 * step, but in O(n²) time instead of O(n³): each cluster follows a chain of
 * mutually-improving nearest neighbors until it lands on a pair that are
 * each other's nearest neighbor (a "reciprocal nearest neighbor", RNN); that
 * pair's merge is provably a valid next step in the correct dendrogram. This
 * is a genuine algorithmic speedup, not an approximation — see
 * `resolveStructuralClusterKeys`'s JSDoc for why an approximation was
 * rejected.
 *
 * Complete-linkage was chosen over single-linkage (connected components of
 * the threshold graph) because single-linkage's "chaining" lets one
 * unrepresentative page transitively merge two otherwise-unrelated
 * templates — the opposite of what template detection needs. Complete-
 * linkage requires *every* pair across two clusters to clear the threshold
 * before merging them, which rules that out. Cluster-to-cluster similarity
 * is maintained via the Lance-Williams update for complete-linkage:
 * `similarity(merged, Z) = min(similarity(X, Z), similarity(Y, Z))`.
 *
 * The algorithm always runs every one of the `size - 1` possible merges to
 * completion (down to a single root), never stopping early at `threshold`.
 * This looks wasteful but isn't optional: Lance-Williams monotonicity
 * (Lance, G. N. & Williams, W. T., 1967, "A General Theory of Classificatory
 * Sorting Strategies," The Computer Journal 9(4)) guarantees no height
 * inversions inside the dendrogram itself (a merge's similarity is always ≥
 * the similarity of every merge nested inside it), but says nothing about
 * the chronological order in which independent, not-yet-connected
 * chains happen to resolve their own RNN pairs — one chain can easily
 * stumble onto a low-similarity RNN pair before a different, still-unvisited
 * chain uncovers a high-similarity one elsewhere. Stopping the whole
 * algorithm at the first below-threshold merge would therefore discard
 * later, still-valid above-threshold merges (confirmed by this file's
 * differential test against a naive reference — an earlier version of this
 * function that broke early on the first below-threshold RNN pair failed it
 * for exactly this reason). Instead, every merge is always folded into the
 * `active`/`similarity` bookkeeping so the algorithm can keep discovering
 * the rest of the true dendrogram, but only merges scoring `>= threshold`
 * are recorded in `parent` (the union-find used for final membership).
 * Monotonicity guarantees this is safe: any merge scoring `>= threshold` was
 * necessarily built out of children merges that scored at least as high, so
 * restricting the union-find to threshold-clearing merges — regardless of
 * the chronological order they were discovered in — reconstructs exactly
 * the correct threshold cut.
 * @param tokenSets
 * @param threshold
 */
function clusterByCompleteLinkage(
	tokenSets: readonly ReadonlySet<string>[],
	threshold: number,
): number[] {
	const size = tokenSets.length;
	const parent = Int32Array.from({ length: size }, (_, index) => index);

	const similarity = new Float64Array(size * size);
	for (let i = 0; i < size; i++) {
		for (let j = i + 1; j < size; j++) {
			const score = jaccardSimilarity(
				requireIndex(tokenSets, i),
				requireIndex(tokenSets, j),
			);
			similarity[i * size + j] = score;
			similarity[j * size + i] = score;
		}
	}

	const active = new Uint8Array(size).fill(1);
	const chain: number[] = [];

	const findFreshStart = (): number => {
		for (let index = 0; index < size; index++) {
			if (requireIndex(active, index) === 1) {
				return index;
			}
		}
		throw new Error(
			'resolveStructuralClusterKeys: no active cluster left to resume from',
		);
	};

	let activeCount = size;
	while (activeCount > 1) {
		if (chain.length === 0) {
			chain.push(findFreshStart());
		}

		const top = requireIndex(chain, chain.length - 1);
		let best = -1;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (let candidate = 0; candidate < size; candidate++) {
			if (candidate !== top && requireIndex(active, candidate) === 1) {
				const score = requireIndex(similarity, top * size + candidate);
				if (score > bestScore) {
					bestScore = score;
					best = candidate;
				}
			}
		}

		const secondFromTop = chain.length >= 2 ? chain.at(-2) : undefined;
		if (best === secondFromTop) {
			chain.pop();
			chain.pop();

			const survivor = Math.min(top, best);
			const dead = Math.max(top, best);
			for (let candidate = 0; candidate < size; candidate++) {
				if (
					candidate !== top &&
					candidate !== best &&
					requireIndex(active, candidate) === 1
				) {
					const merged = Math.min(
						requireIndex(similarity, top * size + candidate),
						requireIndex(similarity, best * size + candidate),
					);
					similarity[survivor * size + candidate] = merged;
					similarity[candidate * size + survivor] = merged;
				}
			}

			active[dead] = 0;
			if (bestScore >= threshold - BOUNDARY_EPSILON) {
				parent[find(parent, dead)] = find(parent, survivor);
			}
			activeCount--;
		} else {
			chain.push(best);
		}
	}

	return Array.from({ length: size }, (_, index) => find(parent, index));
}

/**
 * Resolves, within a single already-blocked group of pages (e.g. one key
 * from {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}),
 * which pages share a structural template. Returns one cluster key per
 * page, in the same order as `tokenSets`. Does not call
 * {@link ./tokenize.js | tokenize} itself (callers pass pages already
 * tokenized and turned into `Set`s, mirroring
 * {@link ./compute-document-frequency.js | computeDocumentFrequency}'s
 * contract) and does not orchestrate multiple blocks — a heterogeneous
 * corpus should be split into blocks by the caller before reaching this
 * function.
 *
 * MinHash/LSH-based approximation and medoid-based refinement of these
 * clusters are intentionally out of scope: NN-chain already computes the
 * exact complete-linkage clustering in O(n²), so there is no accuracy being
 * traded away by not approximating, and no evidence yet that O(n²) is a
 * real bottleneck at the block sizes this function actually sees.
 * @param tokenSets
 * @param options
 * @example
 * ```ts
 * resolveStructuralClusterKeys([
 * 	new Set(['body>header', 'body>main>.card', 'body>footer']),
 * 	new Set(['body>header', 'body>main>.card', 'body>footer']),
 * 	new Set(['body>nav', 'body>main>form']),
 * ]);
 * // ['cluster:0', 'cluster:0', 'cluster:1']
 * ```
 */
export function resolveStructuralClusterKeys(
	tokenSets: readonly ReadonlySet<string>[],
	options?: ResolveStructuralClusterKeysOptions,
): string[] {
	const similarityThreshold =
		options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
	if (!(similarityThreshold >= 0 && similarityThreshold <= 1)) {
		throw new RangeError(
			`resolveStructuralClusterKeys: similarityThreshold must be between 0 and 1, got ${similarityThreshold}`,
		);
	}

	if (tokenSets.length === 0) {
		return [];
	}

	const roots = clusterByCompleteLinkage(tokenSets, similarityThreshold);

	const rootToLabel = new Map<number, string>();
	return roots.map((root) => {
		let label = rootToLabel.get(root);
		if (label === undefined) {
			label = `cluster:${rootToLabel.size}`;
			rootToLabel.set(root, label);
		}
		return label;
	});
}
