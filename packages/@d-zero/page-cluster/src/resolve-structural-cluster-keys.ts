import {
	completeLinkageDendrogram,
	labelsAtThreshold,
} from './complete-linkage-dendrogram.js';
import { deriveComparisonSets } from './derive-comparison-sets.js';

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
 *
 * Before comparing, each page's token set is narrowed to its page-specific
 * content via `splitTokensByFrequency` (see `deriveComparisonSets`) once
 * `tokenSets.length` is large enough for that to be statistically meaningful
 * — below that floor, chrome dilution is accepted as the lesser failure and
 * comparison falls back to the raw sets.
 *
 * The clustering algorithm is NN-chain complete-linkage (Murtagh, F., 1983,
 * "A Survey of Recent Advances in Hierarchical Clustering Algorithms," The
 * Computer Journal 26(4)), implemented in `completeLinkageDendrogram`. The
 * dendrogram is cut at `similarityThreshold` by `labelsAtThreshold`, using
 * Lance-Williams monotonicity (Lance, G. N. & Williams, W. T., 1967, "A
 * General Theory of Classificatory Sorting Strategies," The Computer Journal
 * 9(4)) to guarantee that threshold cuts are safe regardless of the order
 * in which NN-chain discovered the merges.
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

	const comparisonSets = deriveComparisonSets(tokenSets);
	const size = comparisonSets.length;
	const merges = completeLinkageDendrogram(comparisonSets);
	const roots = labelsAtThreshold(size, merges, similarityThreshold);

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
