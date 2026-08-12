import type { CrossClusterDuplicate } from './find-cross-cluster-duplicates.js';

/**
 * Applies a set of confirmed cluster-pair merges to a `clusterKey` array,
 * via union-find over the distinct cluster keys. Every `duplicates` entry is
 * merged unconditionally — deciding *which* {@link CrossClusterDuplicate}s
 * are trustworthy enough to act on (e.g. `similarity === 1` or
 * `corroboratedByMirrorAxis`) is the caller's job, same separation of
 * detection from action as
 * {@link ./find-cross-cluster-duplicates.js | findCrossClusterDuplicates}
 * itself.
 *
 * The surviving key for a merged group is its alphabetically smallest
 * member — arbitrary but deterministic, so repeated calls on the same input
 * produce the same output (mirrors the "lower index wins" rule
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s own
 * union-find already uses).
 * @param clusterKeys Every page's current cluster key, in input order.
 * @param duplicates Cluster-pair merges to apply.
 * @example
 * ```ts
 * const merged = mergeValidatedClusters(
 *   clusterKeys,
 *   duplicates.filter((d) => d.similarity === 1 || d.corroboratedByMirrorAxis),
 * );
 * ```
 */
export function mergeValidatedClusters(
	clusterKeys: readonly string[],
	duplicates: readonly CrossClusterDuplicate[],
): string[] {
	const parent = new Map<string, string>();
	const find = (key: string): string => {
		let root = key;
		while (parent.has(root)) root = parent.get(root)!;
		// Path compression for cheap repeated lookups within this call.
		let cur = key;
		while (cur !== root) {
			const next = parent.get(cur)!;
			parent.set(cur, root);
			cur = next;
		}
		return root;
	};

	for (const { clusterKeyA, clusterKeyB } of duplicates) {
		const rootA = find(clusterKeyA);
		const rootB = find(clusterKeyB);
		if (rootA === rootB) continue;
		const [smaller, larger] = rootA < rootB ? [rootA, rootB] : [rootB, rootA];
		parent.set(larger, smaller);
	}

	return clusterKeys.map((key) => (parent.has(key) ? find(key) : key));
}
