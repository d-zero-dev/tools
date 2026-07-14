import { jaccardSimilarity } from './jaccard-similarity.js';

/**
 * One merge event in the complete-linkage dendrogram. `survivor` is the
 * lower index (kept active), `dead` the higher (deactivated), `height`
 * is the Jaccard similarity at which the merge occurred. All `n - 1`
 * merges for `n` input sets are recorded, including those below any
 * particular threshold — the caller decides which heights are meaningful
 * via `labelsAtThreshold`.
 */
export type DendrogramMerge = {
	readonly survivor: number;
	readonly dead: number;
	readonly height: number;
};

/**
 * `jaccardSimilarity()` returns a floating-point division that can land a
 * hair below the caller's threshold even when mathematically equal. Same
 * epsilon as `resolve-structural-cluster-keys.ts`.
 */
const BOUNDARY_EPSILON = 1e-9;

/**
 * `noUncheckedIndexedAccess` makes indexed reads return `T | undefined`.
 * Call sites here index positions this function itself generated (NN-chain
 * internal arrays), so the throw branch is unreachable in practice — it exists
 * solely to satisfy the compiler without a non-null assertion everywhere.
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('completeLinkageDendrogram: index out of bounds');
	}
	return value;
}

/**
 * Path-compressed union-find root lookup. `labelsAtThreshold` rebuilds the
 * cluster label for each item by following its parent chain to the root;
 * path compression keeps repeated lookups O(α) instead of O(n).
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
 * Computes the complete-linkage dendrogram for `tokenSets` via the NN-chain
 * algorithm (Murtagh, F., 1983) and returns all `n - 1` merge events in
 * discovery order. This is the same O(n²) NN-chain implementation as
 * `resolve-structural-cluster-keys.ts` — extracted here so that callers can
 * record the full height sequence and apply an arbitrary threshold cut via
 * `labelsAtThreshold`, rather than committing to a fixed threshold upfront.
 *
 * Recording all merges (not just threshold-clearing ones) is essential for
 * `autoCutThreshold`: to find the largest gap in the height sequence, every
 * height must be available regardless of where the eventual cut lands.
 * @param tokenSets
 */
export function completeLinkageDendrogram(
	tokenSets: readonly ReadonlySet<string>[],
): DendrogramMerge[] {
	const size = tokenSets.length;
	if (size <= 1) return [];

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
	const merges: DendrogramMerge[] = [];

	const findFreshStart = (): number => {
		for (let index = 0; index < size; index++) {
			if (requireIndex(active, index) === 1) return index;
		}
		throw new Error('completeLinkageDendrogram: no active cluster left to resume from');
	};

	let activeCount = size;
	while (activeCount > 1) {
		if (chain.length === 0) chain.push(findFreshStart());

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
			merges.push({ survivor, dead, height: bestScore });
			activeCount--;
		} else {
			chain.push(best);
		}
	}

	return merges;
}

/**
 * Reconstructs cluster labels for all `size` original items at a given
 * similarity threshold, using the merge list from `completeLinkageDendrogram`.
 *
 * Lance-Williams monotonicity guarantees that only merges at `>= threshold`
 * need to be applied to reconstruct the correct threshold cut, regardless of
 * the order in which NN-chain discovered them. This is the same invariant
 * documented in `resolve-structural-cluster-keys.ts`'s JSDoc for
 * `clusterByCompleteLinkage`.
 * @param size Total number of items (= length of the original `tokenSets`).
 * @param merges All merge events from `completeLinkageDendrogram`.
 * @param threshold Similarity threshold; merges below this are ignored.
 */
export function labelsAtThreshold(
	size: number,
	merges: readonly DendrogramMerge[],
	threshold: number,
): number[] {
	const parent = Int32Array.from({ length: size }, (_, i) => i);

	for (const { survivor, dead, height } of merges) {
		if (height >= threshold - BOUNDARY_EPSILON) {
			parent[find(parent, dead)] = find(parent, survivor);
		}
	}

	return Array.from({ length: size }, (_, i) => find(parent, i));
}
