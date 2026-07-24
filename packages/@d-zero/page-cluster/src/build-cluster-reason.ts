import type { BlockingReason } from './derive-blocking-reason.js';
import type { LandmarkType } from './extract-landmarks.js';
import type { PerPageLandmarkInstance } from './per-page-landmark-signatures.js';

import {
	DEFAULT_CHROME_OVERLAP_THRESHOLD,
	isChromeLandmarkInstance,
} from './is-chrome-landmark-instance.js';
import { computeQuorumCore } from './merge-cross-block-clusters.js';
import { ALL_LANDMARK_TYPES } from './per-page-landmark-signatures.js';
import { shellQuorum } from './shell-quorum.js';

/**
 * One final cluster's common-vs-varying profile for a single landmark type
 * (header/footer/nav/aside/form/search), derived by running
 * {@link ./shell-quorum.js | shellQuorum} on just that type's instances across
 * every member page. Absent from {@link ClusterReason}'s `landmarks` entirely
 * when no member page carries an instance of the type.
 */
export type LandmarkClusterProfile = {
	/** Fraction (0–1) of the cluster's member pages carrying at least one instance of this type. */
	readonly presenceRate: number;
	/**
	 * Fraction (0–1) of this type's instances, across all member pages, that
	 * {@link ./is-chrome-landmark-instance.js | isChromeLandmarkInstance}
	 * classified as chrome against this cluster's own shell for the type —
	 * the "header/footer is shared chrome" half of the user-facing story.
	 *
	 * The denominator is per-page-deduplicated instances (same rule
	 * {@link ./per-page-landmark-signatures.js | computePerPageLandmarkInstances}
	 * always applies: two instances on the same page that tokenize to the
	 * same signature — a CMS-duplicated footer, or a `<header
	 * role="navigation">` matching both `header` and `nav` at the identical
	 * span — count once). A caller reconstructing a single instance's chrome
	 * verdict via `extractLandmarks` + `tokenize` +
	 * `isChromeLandmarkInstance` classifies that one instance correctly
	 * regardless of this rule; only a caller trying to reproduce this exact
	 * ratio by counting raw, un-deduplicated instances across a page would
	 * see a different number.
	 */
	readonly chromeRate: number;
	/**
	 * The shell token set `shellQuorum` discovered for this type within this
	 * cluster. Exposed as raw evidence — comparing two sibling clusters'
	 * `shellTokens` for the same type (e.g. via
	 * {@link ./jaccard-similarity.js | jaccardSimilarity}) is how a caller
	 * answers "do these two clusters share the same footer but differ in
	 * whether they have a sidebar nav".
	 */
	readonly shellTokens: readonly string[];
	/** How many member pages contributed at least one instance of this type. */
	readonly memberCountWithInstance: number;
};

/**
 * Structured, uninterpreted explanation of why a final cluster's member
 * pages ended up together, and which sibling clusters (same Pass-0 block,
 * different final cluster) they were nonetheless split from. Deliberately
 * carries no human-readable text or verdicts ("these are the same template
 * except for X") — that judgment belongs to the caller, which has the
 * product context (and the localization requirements) `@d-zero/page-cluster`
 * itself does not.
 */
export type ClusterReason = {
	/** Number of pages this final cluster contains. */
	readonly memberCount: number;
	/**
	 * The distinct Pass-0 blocking keys that fed into this final cluster, and
	 * the evidence behind each. Usually one entry; more than one means Stage B
	 * merged pages that started in different blocks — itself a notable part
	 * of the explanation (e.g. two differently-styled URL sections turned out
	 * to share the same DOM template).
	 */
	readonly blocking: readonly {
		readonly blockKey: string;
		readonly reason: BlockingReason;
	}[];
	/**
	 * The frequency-quorum core of this cluster's DOM structural tokens (see
	 * {@link ./merge-cross-block-clusters.js | computeQuorumCore}) — the
	 * "this DOM structure is common" evidence, independent of CSS or
	 * landmarks.
	 */
	readonly structuralCoreTokens: readonly string[];
	/** Per-landmark-type commonality. Types absent from every member page are omitted. */
	readonly landmarks: { readonly [K in LandmarkType]?: LandmarkClusterProfile };
	/**
	 * Final cluster keys that share at least one Pass-0 block with this
	 * cluster but were not merged into it by Stage A/B — candidates for "why
	 * did these split" comparison. Does not include clusters that started in
	 * a different block from this one.
	 */
	readonly siblingClusterKeys: readonly string[];
};

/**
 * Builds one final cluster's {@link ClusterReason} from data Stage A/B
 * already computed for clustering itself — no re-tokenization, no re-running
 * `shellQuorum`'s corpus-wide discovery pass, just re-deriving per-type shells
 * and quorum cores from the same pooled member state
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters} already
 * built and would otherwise have discarded.
 * @param input
 * @param input.tokenSets
 * @param input.landmarkInstances
 * @param input.blocking
 * @param input.siblingClusterKeys
 * @param input.chromeThreshold
 * @example
 * ```ts
 * const reason = buildClusterReason({
 *   tokenSets: finalGroup.tokenSets,
 *   landmarkInstances: finalGroup.landmarkInstances,
 *   blocking: [{ blockKey: 'css:abc123', reason: { kind: 'css', distinctiveStylesheetHrefs: ['/a.css'] } }],
 *   siblingClusterKeys: ['["css:abc123","cluster:1"]'],
 * });
 * ```
 */
export function buildClusterReason(input: {
	readonly tokenSets: readonly ReadonlySet<string>[];
	readonly landmarkInstances: readonly (readonly PerPageLandmarkInstance[])[];
	readonly blocking: readonly {
		readonly blockKey: string;
		readonly reason: BlockingReason;
	}[];
	readonly siblingClusterKeys: readonly string[];
	readonly chromeThreshold?: number;
}): ClusterReason {
	const memberCount = input.tokenSets.length;
	const chromeThreshold = input.chromeThreshold ?? DEFAULT_CHROME_OVERLAP_THRESHOLD;

	const structuralCoreTokens = [...computeQuorumCore(input.tokenSets)].toSorted();

	const landmarks: { [K in LandmarkType]?: LandmarkClusterProfile } = {};
	for (const type of ALL_LANDMARK_TYPES) {
		const perMemberInstancesOfType = input.landmarkInstances.map((instances) =>
			instances.filter((instance) => instance.type === type),
		);
		const membersWithInstance = perMemberInstancesOfType.filter(
			(instances) => instances.length > 0,
		);
		if (membersWithInstance.length === 0) continue;

		const shellTokens = shellQuorum(perMemberInstancesOfType);
		let chromeInstanceCount = 0;
		let totalInstanceCount = 0;
		for (const instances of membersWithInstance) {
			for (const instance of instances) {
				totalInstanceCount++;
				if (isChromeLandmarkInstance(instance.tokens, shellTokens, chromeThreshold)) {
					chromeInstanceCount++;
				}
			}
		}

		landmarks[type] = {
			presenceRate: membersWithInstance.length / memberCount,
			chromeRate: totalInstanceCount === 0 ? 0 : chromeInstanceCount / totalInstanceCount,
			shellTokens: [...shellTokens].toSorted(),
			memberCountWithInstance: membersWithInstance.length,
		};
	}

	return {
		memberCount,
		blocking: input.blocking,
		structuralCoreTokens,
		landmarks,
		siblingClusterKeys: input.siblingClusterKeys,
	};
}
