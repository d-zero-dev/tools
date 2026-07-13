import type { ExtractLandmarksResult } from './extract-landmarks.js';
import type { CrossBlockUnit } from './merge-cross-block-clusters.js';
import type { TokenizeOptions } from './types.js';

import { assignContainedClusters } from './assign-contained-clusters.js';
import { autoCutThreshold } from './auto-cut-threshold.js';
import { capContentDepth } from './cap-content-depth.js';
import { collapseAnonymousDivs } from './collapse-anonymous-divs.js';
import {
	completeLinkageDendrogram,
	labelsAtThreshold,
} from './complete-linkage-dendrogram.js';
import {
	deriveComparisonSets,
	MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT,
} from './derive-comparison-sets.js';
import { detectContentDepthCap } from './detect-content-depth-cap.js';
import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';
import { reservoirSample } from './reservoir-sample.js';
import { tokenize } from './tokenize.js';

/**
 * Maximum number of member pages retained per `CrossBlockUnit` for Stage B.
 * Units larger than this are down-sampled deterministically (URL-independent
 * — seeded from the unit key) via {@link ./reservoir-sample.js | reservoirSample}.
 *
 * ## Why cap
 *
 * `CrossBlockUnit.memberTokenSets` is `readonly ReadonlySet<string>[]`.
 * V8's Set carries substantial per-entry overhead (hash slot + string
 * reference + backing array padding), so a 200-token set weighs ~20 KB in
 * practice — an order of magnitude more than the raw byte sum of its
 * strings. Without a cap, the streaming path's batch-by-batch accumulation
 * of `CrossBlockUnit`s across a 176k-page corpus reached OOM at ~100k pages
 * on an 8 GB heap, entirely from Set overhead of retained members.
 *
 * ## Why the value
 *
 * Stage B's per-round computations (`computeDocumentFrequency`,
 * `quorumCore`, `shellQuorum`) are frequency-based, so a representative
 * sample gives statistically similar cores and shells to the full
 * membership. 100 members is enough for the 80 % quorum threshold to
 * discriminate signal from noise (needs ≥ 80 of 100 = 80 % vs. the
 * corpus-wide 80 %), and keeps a per-unit memory footprint of ~2.5 MB
 * (100 × ~25 KB per member incl. tokens + landmark instances). For a
 * corpus with ~500 units that's ~1.25 GB — well within an 8 GB heap.
 *
 * Applied at unit *creation* here in {@link ./stage-a-per-block.js | stageAPerBlock},
 * and re-applied after each merge in
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * `applyMerges`, so a merged group can never balloon past this cap either.
 *
 * ## In-memory-path preservation
 *
 * A block with `≤ MAX_MEMBERS_PER_UNIT` members hits the deterministic
 * "return the full input unchanged" branch of {@link ./reservoir-sample.js | reservoirSample},
 * so every previously validated corpus (302 / 1,416 / 8,936 / 89 pages)
 * keeps every member of every unit — the cap only kicks in for cluster
 * sizes that could not run under the pre-refactor implementation anyway.
 */
export const MAX_MEMBERS_PER_UNIT = 100;

/**
 * @see stageAPerBlock
 */
export type StageAPerBlockOptions = TokenizeOptions & {
	readonly similarityThreshold?: number;
	readonly autoCapMainDepth?: boolean;
	readonly minKneeRatio?: number;
	readonly maxCandidateDepth?: number;
	/**
	 * When set, any Stage-A cluster with more than this many members has its
	 * `memberTokenSets` / `memberLandmarkInstances` down-sampled via
	 * {@link ./reservoir-sample.js | reservoirSample} (seed = unit key,
	 * deterministic). Callers on the in-memory path omit this so validated
	 * corpora keep full membership; the streaming path sets it to
	 * {@link MAX_MEMBERS_PER_UNIT} to bound accumulated Stage B state.
	 */
	readonly capMembers?: number;
};

/**
 * @see stageAPerBlock
 */
export type StageAPerBlockInput = {
	/** The block's block key (as produced by pass 0). */
	readonly blockKey: string;
	/**
	 * Original input indices of this block's members, in input order. Returned
	 * unchanged in the mapping so the caller can write pages' cluster keys
	 * back into a global keys array. Same length as `preparedHtml` /
	 * `landmarks` / `localLandmarkTokensByPage`.
	 */
	readonly memberIndices: readonly number[];
	/**
	 * The block's per-page landmark-excised (and optionally
	 * `removeContentBlocks`-stripped) HTML — what the in-memory driver calls
	 * `preparedHtml`. Provided by the caller to keep this helper stateless
	 * about `excludeLandmarks` / `contentBlockAttribute` decisions.
	 */
	readonly preparedHtml: readonly string[];
	/** The block's per-page {@link ./extract-landmarks.js | ExtractLandmarksResult}. */
	readonly landmarks: readonly ExtractLandmarksResult[];
	/**
	 * The block's per-page local-landmark reinjection token sets. Same-shape
	 * output of {@link ./resolve-page-cluster-keys.js | computeLocalLandmarkTokens},
	 * pre-computed by the caller so this helper stays agnostic to whether
	 * chrome discovery ran corpus-wide (small-corpus in-memory path) or
	 * per-block (large-corpus streaming path).
	 */
	readonly localLandmarkTokensByPage: readonly ReadonlySet<string>[];
};

/**
 * @see stageAPerBlock
 */
export type StageAPerBlockResult = {
	/**
	 * Map from `memberIndices[i]` (original input index) to that page's
	 * post-Stage-A cluster key. Keys are of the form
	 * `JSON.stringify([blockKey, "cluster:N"])` (unchanged from the in-memory
	 * driver's per-block loop) — Stage B later rewrites them into merged
	 * groups when it finds cross-block matches.
	 */
	readonly pageKeys: ReadonlyMap<number, string>;
	/**
	 * One {@link ./merge-cross-block-clusters.js | CrossBlockUnit} per
	 * post-Stage-A cluster, in first-seen order.
	 */
	readonly crossBlockUnits: readonly CrossBlockUnit[];
};

/**
 * Runs Stage A (dendrogram + auto-cut + containment assignment) on one
 * block's pages, and returns both the per-page cluster keys and the
 * {@link ./merge-cross-block-clusters.js | CrossBlockUnit} rows that Stage B
 * needs afterward.
 *
 * ## Why extract this from `resolvePageClusterKeys`?
 *
 * The in-memory driver holds every page's HTML/landmarks/preparedHtml in
 * arrays before the per-block loop begins, and any dataset large enough to
 * break memory does so before Stage A even starts. For streaming mode this
 * inner per-block loop needs to run for one block at a time: read that
 * block's HTML, run Stage A, emit its crossBlockUnit rows, free the block's
 * memory, move to the next. Splitting the Stage A body into a standalone
 * function is what makes that per-block iteration possible without
 * duplicating the Stage A logic between the two drivers.
 *
 * Preserves the in-memory driver's per-block behavior exactly for the same
 * inputs — same `preparedHtml`, same `landmarks`, same
 * `localLandmarkTokensByPage`, same `options` → same output.
 * @param input
 * @param options
 */
export function stageAPerBlock(
	input: StageAPerBlockInput,
	options?: StageAPerBlockOptions,
): StageAPerBlockResult {
	const { blockKey, memberIndices, preparedHtml, landmarks, localLandmarkTokensByPage } =
		input;
	const similarityThreshold = options?.similarityThreshold ?? 0.8;
	const autoCapMainDepth = options?.autoCapMainDepth ?? true;

	// A block of 1 can never produce more than one cluster regardless of how
	// it's tokenized — nothing to compare it against — so detecting a knee
	// and capping for it would only spend a full multi-depth sweep to arrive
	// back at the same single-cluster result. Skipped rather than swept.
	const maxMainDepth =
		autoCapMainDepth && preparedHtml.length > 1
			? detectContentDepthCap(preparedHtml, options)
			: undefined;
	const blockTokenSets: ReadonlySet<string>[] = preparedHtml.map((html, position) => {
		const capped =
			maxMainDepth === undefined
				? html
				: capContentDepth(html, { landmark: 'main', maxDepth: maxMainDepth })
						.remainderHtml;
		const tokens = new Set(tokenize(capped, options).tokens);
		// Reinject each page's local-landmark tokens (see
		// resolve-page-cluster-keys.ts's computeLocalLandmarkTokens JSDoc).
		const localTokens = localLandmarkTokensByPage[position];
		if (localTokens !== undefined) {
			for (const token of localTokens) tokens.add(token);
		}
		return tokens;
	});

	// Stage A: dendrogram + auto-cut + optional containment assignment
	const blockSize = blockTokenSets.length;
	const comparisonSets = deriveComparisonSets(blockTokenSets);
	const merges = completeLinkageDendrogram(comparisonSets);
	const cut = autoCutThreshold(
		merges.map((m) => m.height),
		similarityThreshold,
	);
	let roots = labelsAtThreshold(blockSize, merges, cut);

	// Containment assignment only for blocks large enough to have had
	// frequency-based comparison sets (same MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT
	// threshold as deriveComparisonSets).
	if (blockSize >= MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT) {
		const clusterTokens = new Map<number, Set<string>>();
		const clusterPageCount = new Map<number, number>();
		for (let i = 0; i < blockSize; i++) {
			const r = roots[i]!;
			let tokens = clusterTokens.get(r);
			if (!tokens) {
				tokens = new Set();
				clusterTokens.set(r, tokens);
			}
			for (const t of comparisonSets[i]!) tokens.add(collapseAnonymousDivs(t));
			clusterPageCount.set(r, (clusterPageCount.get(r) ?? 0) + 1);
		}
		const entries = [...clusterTokens.entries()].map(([id, tokens]) => ({
			id,
			tokens: tokens as ReadonlySet<string>,
			pageCount: clusterPageCount.get(id) ?? 0,
		}));
		const contResult = assignContainedClusters(entries);
		roots = roots.map((r) => contResult.get(r) ?? r);
	}

	// Assign string cluster labels in first-seen order
	const rootToLabel = new Map<number, string>();
	const localLabels = roots.map((root) => {
		let label = rootToLabel.get(root);
		if (label === undefined) {
			label = `cluster:${rootToLabel.size}`;
			rootToLabel.set(root, label);
		}
		return label;
	});

	const pageKeys = new Map<number, string>();
	const unitKeyToPositions = new Map<string, number[]>();
	for (const [position, memberIndex] of memberIndices.entries()) {
		const unitKey = JSON.stringify([blockKey, localLabels[position]!]);
		pageKeys.set(memberIndex, unitKey);
		let positions = unitKeyToPositions.get(unitKey);
		if (!positions) {
			positions = [];
			unitKeyToPositions.set(unitKey, positions);
		}
		positions.push(position);
	}

	// Pre-tokenize each page's landmark instances once now, and hand Stage B
	// those instance lists directly instead of the ~10×-larger raw
	// `ExtractLandmarksResult` objects. Stage B's only consumer of landmark
	// data (`shellQuorum`) previously re-ran `computePerPageLandmarkInstances`
	// on every call — the new signature accepts pre-tokenized instances, so
	// we compute them once per page here and skip the repeat work as a
	// side benefit. The memory reduction is the primary reason: 176k pages ×
	// ~1 KB PerPageLandmarkInstance is ~200 MB, versus ~2–3 GB when we kept
	// full ExtractLandmarksResult objects.
	const memberLandmarkInstancesByPage = computePerPageLandmarkInstances(
		landmarks,
		options,
	);

	const crossBlockUnits: CrossBlockUnit[] = [];
	for (const [unitKey, positions] of unitKeyToPositions) {
		// Down-sample any unit that exceeds `capMembers` (opt-in — the
		// streaming path passes MAX_MEMBERS_PER_UNIT; the in-memory path
		// omits the option to preserve full-membership Stage B semantics
		// unchanged for validated corpora). Reservoir seed is the unit key
		// so the sampling is deterministic across runs for the same input.
		const cap = options?.capMembers;
		const sampledPositions =
			cap !== undefined && positions.length > cap
				? reservoirSample(positions, cap, unitKey)
				: positions;
		crossBlockUnits.push({
			key: unitKey,
			memberTokenSets: sampledPositions.map((pos) => blockTokenSets[pos]!),
			memberLandmarkInstances: sampledPositions.map(
				(pos) => memberLandmarkInstancesByPage[pos]!,
			),
		});
	}
	return { pageKeys, crossBlockUnits };
}
