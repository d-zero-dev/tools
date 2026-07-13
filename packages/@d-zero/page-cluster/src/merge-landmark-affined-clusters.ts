import type { ExtractLandmarksResult, LandmarkType } from './extract-landmarks.js';
import type { TokenizeOptions } from './types.js';

import { canonicalizeTokenSet } from './canonicalize-token-set.js';
import { jaccardSimilarity } from './jaccard-similarity.js';
import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';

/**
 * The four landmark types checked, in the fixed order every signature string
 * built below iterates them in — order must be stable so two pages with the
 * same set of matching-and-rare types always produce byte-identical
 * signature strings.
 */
const LANDMARK_TYPES: readonly LandmarkType[] = ['header', 'footer', 'nav', 'aside'];

const DEFAULT_SIMILARITY_THRESHOLD = 0.8;
const DEFAULT_LANDMARK_RARITY_THRESHOLD = 0.05;
const DEFAULT_LANDMARK_GATE_SIMILARITY_THRESHOLD = 0.6;

/**
 * Same technique and value as `BOUNDARY_EPSILON` in
 * `resolve-structural-cluster-keys.ts` and `split-tokens-by-frequency.ts`,
 * kept as an independent per-file copy by this package's convention (see
 * `resolve-structural-cluster-keys.ts`'s own `BOUNDARY_EPSILON` JSDoc).
 */
const BOUNDARY_EPSILON = 1e-9;

/**
 * Prefix distinguishing a landmark-gated merge's key from every other key
 * family this package produces (`css:`/`path:`/`orphan-merge:`/the
 * `[blockKey, "cluster:N"]` JSON pairs `resolvePageClusterKeys` itself
 * emits), so the families can never collide. Mirrors
 * `reassign-orphan-block-keys.ts`'s `REASSIGNED_KEY_PREFIX`.
 */
const MERGED_KEY_PREFIX = 'landmark-merge:';

/**
 * @see mergeLandmarkAffinedClusters
 */
export type MergeLandmarkAffinedClustersOptions = TokenizeOptions & {
	/**
	 * Reused as the landmark-variant identity threshold inside
	 * `computeLandmarkStatus`. Must be in `[0, 1]` (`RangeError` otherwise).
	 * Defaults to `0.8`, matching `resolveStructuralClusterKeys`'s own
	 * default — this file never calls that function, but the two thresholds
	 * represent the same concept ("how much token overlap counts as the same
	 * design").
	 *
	 * Deliberately not a separate, independent option: when
	 * `resolvePageClusterKeys` forwards its caller's single `options` object
	 * to both `resolveStructuralClusterKeys` (primary content clustering) and
	 * this file (landmark-variant identity), the same `similarityThreshold`
	 * value drives both, so loosening one to re-tune primary clustering (the
	 * documented `excludeLandmarks`/`similarityThreshold` interaction on
	 * `resolvePageClusterKeys`) also loosens landmark-variant matching. This
	 * mirrors `resolve-landmark-variant-keys.ts`'s own precedent
	 * (`resolveLandmarkVariantKeys` likewise forwards its caller's
	 * `options.similarityThreshold` straight into
	 * `resolveStructuralClusterKeys` with no landmark-specific override) and
	 * keeps the option surface to the three fields this file actually adds.
	 * Accepted as a known trade-off rather than split into its own knob until
	 * real-corpus tuning shows the two thresholds genuinely need to diverge —
	 * the same "starting heuristic, not yet corpus-validated" status this
	 * option's own default already carries.
	 */
	similarityThreshold?: number;
	/**
	 * Upper bound, as a fraction of the whole corpus (`[0, 1]`), on how many
	 * pages may share a given (landmark type, variant) pair before that
	 * variant is considered too common to serve as evidence of a genuine
	 * template affinity. Strictly `<` this fraction ("rare", not
	 * "rare-or-equal"). `RangeError` outside `[0, 1]`. Defaults to `0.05` —
	 * an unvalidated starting heuristic, the same status as
	 * `similarityThreshold`'s own `0.8` default (see this file's JSDoc for
	 * why real-corpus validation is out of scope for this change).
	 */
	landmarkRarityThreshold?: number;
	/**
	 * The secondary, looser complete-linkage content-similarity threshold
	 * applied only to pages whose landmark signature already qualifies (see
	 * `mergeLandmarkAffinedClusters`'s JSDoc). `RangeError` outside `[0, 1]`.
	 * Defaults to `0.6` — the value a withdrawn earlier prototype of this
	 * same mechanism proposed, and also the value
	 * `resolvePageClusterKeys`'s own `excludeLandmarks` JSDoc cites as having
	 * correctly re-merged a real 3-page block once landmarks were excluded
	 * and the raw-token `similarityThreshold` (`0.8`) became too strict.
	 */
	landmarkGateSimilarityThreshold?: number;
};

/**
 * Reads `values[index]`, throwing instead of returning `undefined`. Every
 * call site here indexes with a position this function generated itself, so
 * the thrown branch is unreachable in practice; it exists to satisfy
 * `noUncheckedIndexedAccess` without a non-null assertion. Independent copy
 * by this package's established convention — see
 * `resolve-page-cluster-keys.ts`'s own `requireIndex` JSDoc.
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('mergeLandmarkAffinedClusters: index out of bounds');
	}
	return value;
}

/**
 * Reads `map.get(key)`, throwing instead of returning `undefined`. Every
 * call site here looks up a key this function (or its caller, in the same
 * pass) just inserted, so the thrown branch is unreachable in practice — the
 * `Map` analogue of `requireIndex` above.
 * @param map
 * @param key
 */
function requireMapValue<K, V>(map: ReadonlyMap<K, V>, key: K): V {
	const value = map.get(key);
	if (value === undefined) {
		throw new Error('mergeLandmarkAffinedClusters: expected map entry missing');
	}
	return value;
}

/**
 * Validates that `value` (one of this file's three `[0, 1]`-range options,
 * `name` being its option name for the thrown message) is in range,
 * throwing `RangeError` otherwise. Shared by
 * `validateMergeLandmarkAffinedClustersOptions`'s three checks so their
 * range and message format can never drift apart from each other.
 * @param value
 * @param name
 */
function requireThreshold(value: number, name: string): number {
	if (!(value >= 0 && value <= 1)) {
		throw new RangeError(
			`mergeLandmarkAffinedClusters: ${name} must be between 0 and 1, got ${value}`,
		);
	}
	return value;
}

/**
 * Validates `similarityThreshold`/`landmarkRarityThreshold`/
 * `landmarkGateSimilarityThreshold` without running
 * `mergeLandmarkAffinedClusters` itself — exported so
 * `resolvePageClusterKeys` can fail fast on bad options even when `pages` is
 * empty (its own per-block loop never reaches this function at all in that
 * case). Mirrors `detect-content-depth-cap.ts`'s
 * `validateDetectContentDepthCapOptions` exact rationale and shape.
 * @param options
 * @example
 * ```ts
 * // Fails fast on a bad option even though nothing here would otherwise
 * // call mergeLandmarkAffinedClusters yet (e.g. cluster keys haven't been
 * // computed).
 * validateMergeLandmarkAffinedClustersOptions({ landmarkRarityThreshold: -1 }); // throws RangeError
 * ```
 */
export function validateMergeLandmarkAffinedClustersOptions(
	options?: MergeLandmarkAffinedClustersOptions,
): void {
	requireThreshold(
		options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
		'similarityThreshold',
	);
	requireThreshold(
		options?.landmarkRarityThreshold ?? DEFAULT_LANDMARK_RARITY_THRESHOLD,
		'landmarkRarityThreshold',
	);
	requireThreshold(
		options?.landmarkGateSimilarityThreshold ??
			DEFAULT_LANDMARK_GATE_SIMILARITY_THRESHOLD,
		'landmarkGateSimilarityThreshold',
	);
}

/**
 * Finds the representative (root) of `index`'s set, compressing every
 * traversed link. Independent copy of
 * `resolve-structural-cluster-keys.ts`'s own `find`, by the same convention
 * as `requireIndex` above.
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
 * Complete-linkage merge of a small number of nodes (`nodeCount`) given a
 * precomputed, symmetric `nodeCount`x`nodeCount` similarity matrix. Returns
 * the resulting partition as groups of node indices.
 *
 * Deliberately not a shared import of `resolve-structural-cluster-keys.ts`'s
 * NN-chain implementation, which is hard-wired to compute Jaccard similarity
 * from token sets internally rather than accepting a precomputed matrix.
 * Both call sites in this file (`computeLandmarkStatus`'s deduplicated
 * landmark-variant buckets, and `mergeLandmarkAffinedClusters`'s
 * rare-signature groups' distinct cluster keys) feed this function a
 * `nodeCount` that is self-limited to a small size by construction — see
 * `computeLandmarkStatus`'s own JSDoc for the cost analysis — so a
 * brute-force repeated-best-pair merge (same reference shape as
 * `resolve-structural-cluster-keys.spec.ts`'s differential-test helper) is
 * used directly rather than re-implementing NN-chain a second time for a
 * negligible input size.
 * @param nodeCount
 * @param similarity
 * @param threshold
 */
function mergeSmallClustersByCompleteLinkage(
	nodeCount: number,
	similarity: Float64Array,
	threshold: number,
): number[][] {
	let groups: number[][] = Array.from({ length: nodeCount }, (_, index) => [index]);
	for (;;) {
		let bestPair: [number, number] | undefined;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (let i = 0; i < groups.length; i++) {
			for (let j = i + 1; j < groups.length; j++) {
				let minSimilarity = Number.POSITIVE_INFINITY;
				for (const a of requireIndex(groups, i)) {
					for (const b of requireIndex(groups, j)) {
						minSimilarity = Math.min(
							minSimilarity,
							requireIndex(similarity, a * nodeCount + b),
						);
					}
				}
				if (minSimilarity > bestScore) {
					bestScore = minSimilarity;
					bestPair = [i, j];
				}
			}
		}
		if (!bestPair || bestScore < threshold - BOUNDARY_EPSILON) {
			break;
		}
		const [i, j] = bestPair;
		groups[i] = [...requireIndex(groups, i), ...requireIndex(groups, j)];
		groups = groups.filter((_, index) => index !== j);
	}
	return groups;
}

type LandmarkStatus =
	{ exists: false } | { exists: true; rare: boolean; variantLabel: string };

/**
 * For one landmark type, determines each page's corpus-wide variant identity
 * and whether that variant is rare (see `mergeLandmarkAffinedClusters`'s
 * JSDoc for what "rare" gates). A page missing this landmark type reports
 * `{ exists: false }` unconditionally — it never counts toward any variant's
 * frequency and is never itself "rare" or "common".
 *
 * Does not call `resolveStructuralClusterKeys` (unlike
 * `resolve-landmark-variant-keys.ts`'s own landmark-variant classification).
 * That function unconditionally narrows its input via
 * `deriveComparisonSets` once given 10+ items — stripping out tokens shared
 * by 90%+ of the compared sets as "chrome" and comparing only what's left.
 * That is the right behavior for comparing *whole pages* (shared chrome
 * should not inflate similarity between otherwise-different content), but
 * it is backwards for comparing *landmark fragments to each other*: the
 * stable, shared bulk of a header's markup is exactly the signal that two
 * pages have "the same header design", and stripping it out would leave
 * only incidental per-page differences (e.g. a "current page" nav-highlight
 * class) to compare on. This function therefore uses raw `jaccardSimilarity`
 * directly instead.
 *
 * It also skips the O(n²) all-pairs comparison `resolveStructuralClusterKeys`
 * would otherwise run across the *entire, unblocked* corpus (a real cost:
 * estimated ~19s and ~640MB for a single such call over an 8,936-page corpus,
 * extrapolated from `detectContentDepthCap`'s own measured ~4s/call over a
 * 4,085-page block — four landmark types would multiply that to ~76s). Real
 * sites near-universally reuse byte-identical (post-tokenization) landmark
 * markup across pages of the same template, so pages are first bucketed by
 * exact token-set equality (`canonicalizeTokenSet`, O(n)) before any
 * similarity is computed at all; only the resulting *distinct* buckets
 * (expected in the tens at most, even for a large real corpus) are compared
 * pairwise and complete-linkage-merged. This is not an approximation:
 * deduplicating identical items before a Jaccard-based complete-linkage
 * clustering step, then broadcasting each surviving cluster's label back to
 * every item in the buckets it absorbed, produces the same partition a full
 * item-by-item comparison would (`jaccardSimilarity` of two identical sets is
 * always `1`, so duplicates always land in the same cluster; a duplicate's
 * similarity to every other item is by definition identical to its
 * representative's). If a corpus instead has near-zero landmark reuse (every
 * page's markup for this type is unique), bucket count approaches page
 * count and this degrades toward the O(n²) cost it otherwise avoids — but
 * that scenario also means there is no shared, rare landmark for this
 * mechanism to find evidence in regardless, so the degenerate cost case and
 * the case where this feature has nothing to contribute coincide.
 * @param type
 * @param landmarks
 * @param similarityThreshold
 * @param landmarkRarityThreshold
 * @param options
 */
function computeLandmarkStatus(
	type: LandmarkType,
	landmarks: readonly ExtractLandmarksResult[],
	similarityThreshold: number,
	landmarkRarityThreshold: number,
	options: MergeLandmarkAffinedClustersOptions | undefined,
): LandmarkStatus[] {
	const pageCount = landmarks.length;
	// Per page: canonical instance = the instance whose token-set signature
	// is most common across the corpus, ties broken by document order. This
	// picks the site-wide chrome instance out of the page's landmark array
	// automatically — the shared site header repeats byte-identically across
	// pages and dominates the corpus histogram, while article-specific
	// `<header>`s vary per page and each carry frequency 1. Choosing the
	// most-common instance is the data-driven analogue of the old shallowest-
	// wins rule this file's callers relied on for O(1) bucket collapse via
	// `canonicalizeTokenSet`, without reintroducing a depth heuristic and
	// without letting per-page variation explode the bucket count (the
	// concrete risk documented in this package's tuning JSDoc as ~19s/640MB
	// on a large real corpus if we bucketed a page's whole array).
	const perPageInstances = computePerPageLandmarkInstances(landmarks, options);
	const corpusInstanceCount = new Map<string, number>();
	for (const instances of perPageInstances) {
		for (const inst of instances) {
			if (inst.type !== type) continue;
			corpusInstanceCount.set(
				inst.signature,
				(corpusInstanceCount.get(inst.signature) ?? 0) + 1,
			);
		}
	}
	const tokenSets: (ReadonlySet<string> | undefined)[] = perPageInstances.map(
		(instances) => {
			let best: { tokens: ReadonlySet<string>; count: number } | undefined;
			for (const inst of instances) {
				if (inst.type !== type) continue;
				const count = corpusInstanceCount.get(inst.signature) ?? 0;
				if (best === undefined || count > best.count) {
					best = { tokens: inst.tokens, count };
				}
			}
			return best?.tokens;
		},
	);

	const bucketIndexByKey = new Map<string, number>();
	const bucketRepresentatives: ReadonlySet<string>[] = [];
	const bucketIndexOfPage: (number | undefined)[] = tokenSets.map((tokens) => {
		if (tokens === undefined) {
			return;
		}
		const key = canonicalizeTokenSet(tokens);
		const existing = bucketIndexByKey.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const index = bucketRepresentatives.length;
		bucketRepresentatives.push(tokens);
		bucketIndexByKey.set(key, index);
		return index;
	});

	const bucketCount = bucketRepresentatives.length;
	const similarity = new Float64Array(bucketCount * bucketCount);
	for (let i = 0; i < bucketCount; i++) {
		for (let j = i + 1; j < bucketCount; j++) {
			const score = jaccardSimilarity(
				requireIndex(bucketRepresentatives, i),
				requireIndex(bucketRepresentatives, j),
			);
			similarity[i * bucketCount + j] = score;
			similarity[j * bucketCount + i] = score;
		}
	}
	const groups = mergeSmallClustersByCompleteLinkage(
		bucketCount,
		similarity,
		similarityThreshold,
	);

	const groupLabelByBucketIndex = new Map<number, string>();
	for (const [groupIndex, bucketIndices] of groups.entries()) {
		for (const bucketIndex of bucketIndices) {
			groupLabelByBucketIndex.set(bucketIndex, `variant:${groupIndex}`);
		}
	}

	const variantLabelOfPage: (string | undefined)[] = bucketIndexOfPage.map(
		(bucketIndex) =>
			bucketIndex === undefined
				? undefined
				: requireMapValue(groupLabelByBucketIndex, bucketIndex),
	);

	const countByLabel = new Map<string, number>();
	for (const label of variantLabelOfPage) {
		if (label !== undefined) {
			countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1);
		}
	}

	return variantLabelOfPage.map((label): LandmarkStatus => {
		if (label === undefined) {
			return { exists: false };
		}
		const ratio = requireMapValue(countByLabel, label) / pageCount;
		return { exists: true, rare: ratio < landmarkRarityThreshold, variantLabel: label };
	});
}

/**
 * Re-keys the pages of two or more distinct
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys} clusters
 * onto one shared key when every landmark type present on their pages is
 * both *identical* and *rare* corpus-wide, and their actual content clears a
 * secondary, looser similarity threshold.
 *
 * Reimplements a mechanism previously prototyped under this same name and
 * withdrawn (no trace survives in commit history — this JSDoc is the only
 * record). The withdrawn version merged clusters whenever their
 * header/footer/nav/aside matched, full stop. Validated against two real
 * crawl corpora (302 and 8,936 pages), that produced runaway over-merging:
 * header/footer/nav were present on 99%+ of pages and typically reused
 * site-wide unchanged (see `extractLandmarks`'s own JSDoc for that figure),
 * so "landmarks match" was true for nearly every page pair and carried no
 * discriminative power at all. This reimplementation only ever treats a
 * landmark match as merge evidence when that specific landmark *variant* is
 * itself uncommon corpus-wide (`landmarkRarityThreshold`) — the condition
 * the withdrawn attempt lacked.
 *
 * The match requirement is deliberately the most conservative option
 * considered: *every* landmark type actually present on a page must both
 * match its counterpart's variant and be rare — a page with even one common
 * ("everybody has this exact header") present type contributes no evidence
 * at all, rather than partially qualifying. A looser rule (e.g. "at least
 * one shared rare type is enough") was rejected because it reintroduces a
 * version of the original failure mode: a page could ride a single
 * incidentally-rare landmark into a merge despite otherwise-ordinary,
 * ubiquitous chrome elsewhere on the same page.
 *
 * Frequency is counted corpus-wide, not per-block: a `resolveStructuralClusterKeys`
 * cluster label (`cluster:N`) is only unique within the block it was computed
 * in, but rarity here needs one consistent count across the whole input, the
 * same reason `resolvePageClusterKeys` itself composes `[blockKey,
 * localLabel]` via `JSON.stringify` rather than reusing bare labels across
 * blocks.
 *
 * A page with none of the four landmark types present is excluded from
 * consideration entirely (`existingCount === 0` below) — without this, every
 * landmark-less page across the whole corpus would share one large,
 * unbounded "no landmarks" group, defeating the self-limiting cost bound
 * `landmarkRarityThreshold` is otherwise supposed to guarantee (see
 * `computeLandmarkStatus`'s JSDoc for the cost analysis this depends on).
 *
 * Once pages are grouped by matching-and-rare landmark signature, only
 * signature groups spanning two or more distinct existing cluster keys do
 * any further work. Within such a group, the *content* token sets of the
 * group's distinct cluster keys are complete-linkage-merged at
 * `landmarkGateSimilarityThreshold` — looser than
 * `resolveStructuralClusterKeys`'s own `similarityThreshold`, since the
 * whole point of this mechanism is to bridge clusters whose *content*
 * similarity alone fell just short of the primary threshold. Complete-linkage
 * (not single-linkage) is used for the same reason
 * `resolveStructuralClusterKeys` itself uses it: single-linkage's chaining
 * would let one loosely-matching pair bridge two genuinely-unrelated
 * clusters transitively.
 *
 * The resulting merge is applied at *page* granularity, not by blanket-
 * reassigning every page of the involved cluster keys: only the specific
 * pages that were actually pooled into the qualifying signature group (and,
 * transitively, any other page unioned with them via a different signature
 * group) move onto the shared key. A cluster's pages that never carried the
 * rare landmark evidence keep their original key untouched, even if some
 * other page sharing that same cluster key did qualify and merge elsewhere.
 * This is deliberate, not an incidental restriction: applying a merge
 * decision to *every* page of the involved cluster keys — evidenced by only
 * a small subset of them — would extrapolate a coincidental pairing (e.g.
 * one outlier page in each of two otherwise-unrelated clusters happening to
 * share a rare seasonal-campaign header) into force-merging the clusters'
 * entire, otherwise-dissimilar membership. That is the withdrawn prototype's
 * over-merging failure mode reappearing through a different mechanism
 * (whole-cluster application of a single-pair signal) rather than the
 * landmark-commonality mechanism this file was reimplemented to fix — see
 * this function's own regression test for a worked example.
 *
 * Merged pages are re-keyed to `landmark-merge:${JSON.stringify(sortedKeys)}`
 * (`sortedKeys` being the *original* cluster keys the merged pages came
 * from) — a fresh prefix that cannot collide with `css:`/`path:`/
 * `orphan-merge:` or `resolvePageClusterKeys`'s own `[blockKey, "cluster:N"]`
 * pairs (mirrors `reassign-orphan-block-keys.ts`'s `orphan-merge:` prefix).
 * @param clusterKeys - one existing final key per page, same order/length as `landmarks`/`contentTokenSets`
 * @param landmarks - `extractLandmarks(page.html)`'s full result per page (all four fields, not just `remainderHtml`)
 * @param contentTokenSets - per-page content token sets to use for the secondary similarity gate. Should be independent of whichever landmark markup qualified the page as evidence (e.g. always landmark-excised), so this gate is a genuine second signal rather than re-counting the same landmark tokens already used to select the page — see `resolvePageClusterKeys`'s own call site for how it builds these
 * @param options
 * @example
 * ```ts
 * // tokenize() discards visible text (see its own JSDoc), so the two
 * // header variants below must differ structurally (child element/class),
 * // not merely in text, to compare as different landmark variants.
 * mergeLandmarkAffinedClusters(
 * 	['["css:a", "cluster:0"]', '["css:b", "cluster:0"]', 'path:other'],
 * 	[
 * 		{ header: '<header><i class="mark-a"></i></header>', remainderHtml: '' },
 * 		{ header: '<header><i class="mark-a"></i></header>', remainderHtml: '' },
 * 		{ header: '<header><b class="mark-b"></b></header>', remainderHtml: '' },
 * 	],
 * 	[new Set(['a', 'b']), new Set(['a', 'c']), new Set(['z'])],
 * 	{ landmarkRarityThreshold: 0.7, landmarkGateSimilarityThreshold: 0.3 },
 * );
 * // pages 0 and 1 share an identical header used by only 2 of the 3 pages
 * // (a 2/3 ≈ 0.667 corpus frequency, rare at threshold 0.7) and their
 * // content clears 0.3, so they merge onto one landmark-merge: key; page 2
 * // (a structurally different header) is left untouched
 * ```
 */
export function mergeLandmarkAffinedClusters(
	clusterKeys: readonly string[],
	landmarks: readonly ExtractLandmarksResult[],
	contentTokenSets: readonly ReadonlySet<string>[],
	options?: MergeLandmarkAffinedClustersOptions,
): string[] {
	// Self-validates, unlike relying solely on a caller's separate
	// validateMergeLandmarkAffinedClustersOptions call: mirrors
	// detectContentDepthCap's own first line, and matters here because this
	// function is directly importable via this package's
	// `./merge-landmark-affined-clusters` subpath export, not only reachable
	// through resolvePageClusterKeys's own eager pre-validation. Without
	// this, an out-of-range or NaN threshold would silently defeat
	// mergeSmallClustersByCompleteLinkage's stop condition
	// (`bestScore < threshold - BOUNDARY_EPSILON` never becomes true against
	// a negative or NaN threshold) and force-merge every candidate group
	// into one, with no error raised.
	validateMergeLandmarkAffinedClustersOptions(options);

	if (clusterKeys.length === 0) {
		return [];
	}

	const similarityThreshold =
		options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
	const landmarkRarityThreshold =
		options?.landmarkRarityThreshold ?? DEFAULT_LANDMARK_RARITY_THRESHOLD;
	const landmarkGateSimilarityThreshold =
		options?.landmarkGateSimilarityThreshold ??
		DEFAULT_LANDMARK_GATE_SIMILARITY_THRESHOLD;

	const statusByType = new Map<LandmarkType, LandmarkStatus[]>(
		LANDMARK_TYPES.map((type) => [
			type,
			computeLandmarkStatus(
				type,
				landmarks,
				similarityThreshold,
				landmarkRarityThreshold,
				options,
			),
		]),
	);

	const signatures: (string | undefined)[] = clusterKeys.map((_, pageIndex) => {
		let existingCount = 0;
		let allRare = true;
		const parts: string[] = [];
		for (const type of LANDMARK_TYPES) {
			const status = requireIndex(requireMapValue(statusByType, type), pageIndex);
			if (!status.exists) {
				continue;
			}
			existingCount++;
			if (!status.rare) {
				allRare = false;
			}
			parts.push(`${type}:${status.variantLabel}`);
		}
		return existingCount > 0 && allRare ? parts.join('|') : undefined;
	});

	const pageIndicesBySignature = new Map<string, number[]>();
	for (const [pageIndex, signature] of signatures.entries()) {
		if (signature === undefined) {
			continue;
		}
		const indices = pageIndicesBySignature.get(signature);
		if (indices) {
			indices.push(pageIndex);
		} else {
			pageIndicesBySignature.set(signature, [pageIndex]);
		}
	}

	// Page-level union-find, not cluster-key-level: a merge decision drawn
	// from a signature group's (necessarily partial — only the pages that
	// happened to land in that group) evidence must bind only the specific
	// pages that supplied it. Unioning by cluster key instead would apply a
	// single qualifying pair's evidence to every page sharing either
	// cluster key, including pages with no evidence at all — see this
	// function's own JSDoc "page granularity" section for why that
	// reintroduces the withdrawn prototype's over-merging failure.
	const parent = Int32Array.from({ length: clusterKeys.length }, (_, index) => index);

	for (const pageIndices of pageIndicesBySignature.values()) {
		const memberIndicesByClusterKey = new Map<string, number[]>();
		for (const pageIndex of pageIndices) {
			const clusterKey = requireIndex(clusterKeys, pageIndex);
			const members = memberIndicesByClusterKey.get(clusterKey);
			if (members) {
				members.push(pageIndex);
			} else {
				memberIndicesByClusterKey.set(clusterKey, [pageIndex]);
			}
		}

		const groupClusterKeys = [...memberIndicesByClusterKey.keys()];
		if (groupClusterKeys.length <= 1) {
			continue;
		}

		const groupMembers = groupClusterKeys.map((key) =>
			requireMapValue(memberIndicesByClusterKey, key),
		);

		const k = groupClusterKeys.length;
		const similarity = new Float64Array(k * k);
		for (let i = 0; i < k; i++) {
			for (let j = i + 1; j < k; j++) {
				let minSimilarity = Number.POSITIVE_INFINITY;
				for (const p of requireIndex(groupMembers, i)) {
					for (const q of requireIndex(groupMembers, j)) {
						const score = jaccardSimilarity(
							requireIndex(contentTokenSets, p),
							requireIndex(contentTokenSets, q),
						);
						minSimilarity = Math.min(minSimilarity, score);
					}
				}
				similarity[i * k + j] = minSimilarity;
				similarity[j * k + i] = minSimilarity;
			}
		}

		const mergedGroups = mergeSmallClustersByCompleteLinkage(
			k,
			similarity,
			landmarkGateSimilarityThreshold,
		);
		for (const group of mergedGroups) {
			if (group.length <= 1) {
				continue;
			}
			// Union only the specific evidence pages behind the cluster keys
			// in this merged group — not every page that happens to share
			// those keys elsewhere in the corpus (see this function's JSDoc).
			const evidencePages = group.flatMap((clusterIndex) =>
				requireIndex(groupMembers, clusterIndex),
			);
			const firstPage = requireIndex(evidencePages, 0);
			for (let i = 1; i < evidencePages.length; i++) {
				const rootA = find(parent, firstPage);
				const rootB = find(parent, requireIndex(evidencePages, i));
				if (rootA !== rootB) {
					parent[rootB] = rootA;
				}
			}
		}
	}

	const pageIndicesByRoot = new Map<number, number[]>();
	for (let pageIndex = 0; pageIndex < clusterKeys.length; pageIndex++) {
		const root = find(parent, pageIndex);
		const indices = pageIndicesByRoot.get(root);
		if (indices) {
			indices.push(pageIndex);
		} else {
			pageIndicesByRoot.set(root, [pageIndex]);
		}
	}

	const remap = new Map<number, string>();
	for (const indices of pageIndicesByRoot.values()) {
		const originalKeys = new Set(
			indices.map((index) => requireIndex(clusterKeys, index)),
		);
		// A component every one of whose pages already shares one original
		// cluster key never actually crossed a cluster boundary (the common
		// case: most pages never entered any signature group at all, so
		// their root is just themselves) — nothing to re-key.
		if (originalKeys.size <= 1) {
			continue;
		}
		const mergedKey = `${MERGED_KEY_PREFIX}${JSON.stringify([...originalKeys].toSorted())}`;
		for (const index of indices) {
			remap.set(index, mergedKey);
		}
	}

	return clusterKeys.map((key, index) => remap.get(index) ?? key);
}
