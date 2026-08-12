import { jaccardSimilarity } from './jaccard-similarity.js';
import { reservoirSample } from './reservoir-sample.js';

/**
 * Maximum members sampled per cluster before computing pairwise similarity.
 * Bounds the cost to `O(maxSampleSize²)` per cluster regardless of how large
 * the cluster actually is — 40² / 2 = 780 comparisons, cheap even across
 * many clusters.
 */
const DEFAULT_MAX_SAMPLE_SIZE = 40;

/**
 * Below this median pairwise-similarity, a cluster is flagged `suspicious`.
 *
 * Chosen against the bundled `buildMirroredTemplateFixture` fixture (see
 * `compute-cluster-cohesion.spec.ts`): every single-template cluster there
 * has a median of `1.0` (structural tokens are identical across pages that
 * differ only in text content and per-mirror stylesheet href), while every
 * cluster built by mixing two *different* templates' members has a median
 * at or below `0.70`. `0.75` sits with margin on both sides of that gap.
 * Real crawl data can have single-template clusters with genuinely lower
 * cohesion than this synthetic fixture models (legitimate content-driven
 * structural variation the fixture doesn't produce) — `suspiciousMedianBelow`
 * exists so a caller who has measured their own corpus can override it.
 */
const DEFAULT_SUSPICIOUS_MEDIAN_BELOW = 0.75;

/**
 * Options for {@link computeClusterCohesion}.
 */
export type ClusterCohesionOptions = {
	/** @see DEFAULT_MAX_SAMPLE_SIZE */
	readonly maxSampleSize?: number;
	/** @see DEFAULT_SUSPICIOUS_MEDIAN_BELOW */
	readonly suspiciousMedianBelow?: number;
};

/**
 * One cluster's internal-agreement summary: how similar its members'
 * structural tokens actually are to each other, as opposed to
 * {@link ./merge-cross-block-clusters.js | computeQuorumCore}'s frequency
 * core, which only reports *which* tokens are shared, not *how much* of each
 * member's tokens that core actually covers.
 */
export type ClusterCohesion = {
	readonly clusterKey: string;
	readonly memberCount: number;
	/** How many of `memberCount` members the pairwise comparison sampled. */
	readonly sampledMemberCount: number;
	/** `null` when fewer than 2 members were sampled (nothing to compare). */
	readonly medianPairSimilarity: number | null;
	/** 10th percentile (nearest-rank) of sampled pairwise similarities. */
	readonly p10PairSimilarity: number | null;
	readonly minPairSimilarity: number | null;
	/** `medianPairSimilarity !== null && medianPairSimilarity < suspiciousMedianBelow`. */
	readonly suspicious: boolean;
};

/**
 * @param sortedAscending
 */
function median(sortedAscending: readonly number[]): number {
	const mid = Math.floor(sortedAscending.length / 2);
	if (sortedAscending.length % 2 === 1) return sortedAscending[mid]!;
	return (sortedAscending[mid - 1]! + sortedAscending[mid]!) / 2;
}

/**
 * @param sortedAscending
 */
function p10(sortedAscending: readonly number[]): number {
	const index = Math.floor(0.1 * (sortedAscending.length - 1));
	return sortedAscending[index]!;
}

/**
 * Reports, per cluster, how similar its members' structural token sets
 * actually are to each other — not just which tokens they share (that's
 * {@link ./merge-cross-block-clusters.js | computeQuorumCore}'s job), but
 * whether the members hang together at all. A cluster built by merging
 * unrelated templates has member pairs that mostly disagree even though a
 * small frequency core still exists among them; this surfaces that
 * disagreement directly, as a distribution rather than a single score, since
 * a single "average similarity" would be pulled toward the middle by exactly
 * the kind of partial-overlap noise this is meant to catch.
 *
 * Sampling uses {@link ./reservoir-sample.js | reservoirSample} seeded by
 * each cluster's own key, so repeated calls on the same partition sample the
 * same members and produce the same report.
 *
 * Deliberately returns only structured numbers, no verdict text — same
 * design as {@link ./build-cluster-reason.js | ClusterReason} — so a caller
 * decides what "suspicious" should mean for their own use (an interactive
 * review queue vs. an automated gate might want different behavior for the
 * same numbers).
 * @param membersByKey Every cluster's member token sets, keyed by cluster key.
 * @param options
 * @example
 * ```ts
 * const report = computeClusterCohesion(membersByKey);
 * const worstFirst = [...report].filter((r) => r.suspicious)
 *   .toSorted((a, b) => (a.medianPairSimilarity ?? 0) - (b.medianPairSimilarity ?? 0));
 * ```
 */
export function computeClusterCohesion(
	membersByKey: ReadonlyMap<string, readonly ReadonlySet<string>[]>,
	options?: ClusterCohesionOptions,
): readonly ClusterCohesion[] {
	const maxSampleSize = options?.maxSampleSize ?? DEFAULT_MAX_SAMPLE_SIZE;
	const suspiciousMedianBelow =
		options?.suspiciousMedianBelow ?? DEFAULT_SUSPICIOUS_MEDIAN_BELOW;

	const results: ClusterCohesion[] = [];
	for (const [clusterKey, members] of membersByKey) {
		const sample = reservoirSample(members, maxSampleSize, clusterKey);
		if (sample.length < 2) {
			results.push({
				clusterKey,
				memberCount: members.length,
				sampledMemberCount: sample.length,
				medianPairSimilarity: null,
				p10PairSimilarity: null,
				minPairSimilarity: null,
				suspicious: false,
			});
			continue;
		}

		const similarities: number[] = [];
		for (let a = 0; a < sample.length; a++) {
			for (let b = a + 1; b < sample.length; b++) {
				similarities.push(jaccardSimilarity(sample[a]!, sample[b]!));
			}
		}
		similarities.sort((x, y) => x - y);

		const medianSimilarity = median(similarities);
		results.push({
			clusterKey,
			memberCount: members.length,
			sampledMemberCount: sample.length,
			medianPairSimilarity: medianSimilarity,
			p10PairSimilarity: p10(similarities),
			minPairSimilarity: similarities[0]!,
			suspicious: medianSimilarity < suspiciousMedianBelow,
		});
	}
	return results;
}
