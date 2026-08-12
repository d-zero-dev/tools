import type {
	ClusterCohesion,
	ClusterCohesionOptions,
} from './compute-cluster-cohesion.js';
import type { DetectMirrorAxisOptions, MirrorAxis } from './detect-mirror-axis.js';
import type {
	ClusteredPage,
	CrossClusterDuplicate,
} from './find-cross-cluster-duplicates.js';

import { computeClusterCohesion } from './compute-cluster-cohesion.js';
import { detectMirrorAxis } from './detect-mirror-axis.js';
import { findCrossClusterDuplicates } from './find-cross-cluster-duplicates.js';

/**
 * Options for {@link validateClusterPartition}, forwarded to the three
 * checks it composes.
 */
export type ValidateClusterPartitionOptions = {
	readonly mirrorAxis?: DetectMirrorAxisOptions;
	readonly cohesion?: ClusterCohesionOptions;
	/**
	 * Only `corroboratedSimilarityThreshold` — `mirrorAxis` itself is always
	 * the axis this function just detected, not independently settable here.
	 */
	readonly crossClusterDuplicates?: { readonly corroboratedSimilarityThreshold?: number };
};

/**
 * Structured evidence that a clustering run's partition may need
 * correcting: which pages are plausibly the same template despite ending up
 * in different clusters, and which clusters plausibly mix unrelated
 * templates together. Carries no verdict on whether to act — same design as
 * {@link ./build-cluster-reason.js | ClusterReason} — a caller decides what
 * to do with `crossClusterDuplicates` (e.g. via
 * {@link ./merge-validated-clusters.js | mergeValidatedClusters}) and with
 * `cohesion`'s `suspicious` flags.
 */
export type ClusterPartitionReport = {
	/**
	 * The mirror axis detected across every page's `paths`, or `null` if
	 * none was found — see
	 * {@link ./detect-mirror-axis.js | detectMirrorAxis}.
	 */
	readonly mirrorAxis: MirrorAxis | null;
	/** One entry per distinct cluster key present in `pages`. */
	readonly cohesion: readonly ClusterCohesion[];
	/** See {@link ./find-cross-cluster-duplicates.js | findCrossClusterDuplicates}. */
	readonly crossClusterDuplicates: readonly CrossClusterDuplicate[];
};

/**
 * Validates a finished clustering partition by checking it against itself,
 * rather than trying to get the clustering right the first time: whether
 * pages that ended up in different clusters are nonetheless structurally
 * identical or near-identical (a likely over-split, see
 * {@link ./find-cross-cluster-duplicates.js | findCrossClusterDuplicates}),
 * and whether any single cluster's members actually agree with each other
 * (a likely over-merge, see
 * {@link ./compute-cluster-cohesion.js | computeClusterCohesion}). Neither
 * check depends on *how* the partition was produced — this is deliberately
 * decoupled from `resolvePageClusterKeys`'s own Stage A/B internals so it
 * can validate a partition regardless of its origin, including a stored one
 * loaded back from an archive.
 *
 * Takes already-tokenized pages rather than raw HTML — a caller with a
 * `resolvePageClusterKeys` result already has token sets on hand (or can
 * derive them via {@link ./tokenize.js | tokenize}), and re-tokenizing here
 * would cost a second full corpus pass for no benefit.
 * @param pages
 * @param options
 * @example
 * ```ts
 * const report = validateClusterPartition(pages);
 * const safeToMerge = report.crossClusterDuplicates.filter(
 *   (d) => d.similarity === 1 || d.corroboratedByMirrorAxis,
 * );
 * const mergedKeys = mergeValidatedClusters(clusterKeys, safeToMerge);
 * ```
 */
export function validateClusterPartition(
	pages: readonly ClusteredPage[],
	options?: ValidateClusterPartitionOptions,
): ClusterPartitionReport {
	const mirrorAxis = detectMirrorAxis(
		pages.map((p) => p.paths),
		options?.mirrorAxis,
	);

	const membersByKey = new Map<string, ReadonlySet<string>[]>();
	for (const page of pages) {
		const members = membersByKey.get(page.clusterKey);
		if (members) members.push(page.tokens);
		else membersByKey.set(page.clusterKey, [page.tokens]);
	}
	const cohesion = computeClusterCohesion(membersByKey, options?.cohesion);

	const crossClusterDuplicates = findCrossClusterDuplicates(pages, {
		mirrorAxis,
		corroboratedSimilarityThreshold:
			options?.crossClusterDuplicates?.corroboratedSimilarityThreshold,
	});

	return { mirrorAxis, cohesion, crossClusterDuplicates };
}
