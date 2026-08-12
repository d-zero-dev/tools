import type { PerPageLandmarkInstance } from './per-page-landmark-signatures.js';

import { assignContainedClusters } from './assign-contained-clusters.js';
import { collapseAnonymousDivs } from './collapse-anonymous-divs.js';
import {
	completeLinkageDendrogram,
	labelsAtThreshold,
} from './complete-linkage-dendrogram.js';
import { computeDocumentFrequency } from './compute-document-frequency.js';
import { jaccardSimilarity } from './jaccard-similarity.js';
import { reservoirSample } from './reservoir-sample.js';
import { shapeToken } from './shape-token.js';
import { shellQuorum } from './shell-quorum.js';
import { splitTokensByFrequency } from './split-tokens-by-frequency.js';

/**
 * One cluster (post-Stage-A) entering cross-block comparison.
 *
 * ## Why `memberLandmarkInstances` rather than raw `ExtractLandmarksResult[]`
 *
 * Stage B never reads the full `ExtractLandmarksResult` — it only needs each
 * member page's landmark instances (per-type, per-signature, per-token-set)
 * for `shellQuorum`'s per-token page-frequency histogram. Callers pre-run
 * {@link ./per-page-landmark-signatures.js | computePerPageLandmarkInstances}
 * once at unit creation and hand Stage B the compact instance list instead
 * of the ~10× larger raw landmark HTML strings. This is the single largest
 * memory reduction the streaming path relies on: the difference between a
 * 176k-page corpus fitting in an 8 GB heap and exhausting a 12 GB heap.
 */
export type CrossBlockUnit = {
	readonly key: string;
	readonly memberTokenSets: readonly ReadonlySet<string>[];
	readonly memberLandmarkInstances: readonly (readonly PerPageLandmarkInstance[])[];
	/**
	 * Original corpus index of each member, parallel to `memberTokenSets` —
	 * lets a caller that pools `finalGroupsByRoot`'s output back into
	 * page-level records (e.g. to build a
	 * {@link ./find-cross-cluster-duplicates.js | ClusteredPage}) recover
	 * which page each merged token set came from, without a second
	 * corpus-wide pass. Optional because most callers (every hand-built test
	 * fixture in this file included) only need `mergeCrossBlockClusters` for
	 * its cluster-key decisions and never read this back; omitted entries are
	 * normalized to `-1` internally rather than left misaligned.
	 */
	readonly memberPageIndices?: readonly number[];
};

/**
 * Fixed complete-linkage threshold for the cross-block fine stage.
 *
 * Not auto-cut: cross-block units are few (typically 10–100 for a whole
 * site), so the merge-height distribution is too sparse for max-gap detection
 * to produce a reliable cut. Confirmed on real crawl data: without this fixed
 * floor, auto-cut selected 0.045 on an 18-unit corpus, causing spurious
 * micro-merges.
 */
const CROSS_BLOCK_THRESHOLD = 0.8;

/**
 * Quorum fraction: a token must be present in at least this fraction of a
 * unit's member pages to enter the unit's core.
 *
 * Strict intersection degenerates: a unit of 89 articles sharing only one
 * common distinctive token produces jaccard 1.0 with everything — confirmed
 * on real crawl data. Full union is shell-dominated: 298 pages collapsed into
 * 4 clusters — also confirmed. 80% quorum avoids both failure modes.
 *
 * Not shared with {@link ./shell-quorum.js | shellQuorum}'s own fallback
 * clamp (`SHELL_QUORUM_FALLBACK_FRACTION`) — the two happen to be the same
 * value today because both were validated against the same real crawl
 * corpora, but they are independently tunable.
 */
const QUORUM_FRACTION = 0.8;

/**
 * Shape-based Jaccard threshold for "same skeleton, different class names".
 * Class-name Jaccard for reports/projects/news list pages: 0.000; shape
 * Jaccard: 1.000 on real crawl data.
 */
const SHAPE_JACCARD_THRESHOLD = 0.9;

/**
 * Minimum member-page count for a unit to participate in shape-Jaccard
 * comparison. Single-page units are excluded because their quorum core
 * equals their raw token set with no frequency filtering — any two 1-page
 * units with the same tag skeleton but completely different content will
 * shape-merge spuriously. Multi-page units produce quorum cores that
 * reflect a shared template rather than individual page noise, so shape
 * comparison there is meaningful.
 */
const SHAPE_MIN_PAGES = 2;

/**
 * L2-stage shell corroboration threshold. Prevents cross-microsite false
 * merges: a microsite with a different shell (header/nav/footer) from the
 * main site would otherwise merge via L2 alone. Confirmed on real crawl
 * data: two false merges blocked, correct merges (same shell) unaffected.
 */
const SHELL_CORROBORATION_THRESHOLD = 0.8;

/**
 * Maximum cross-block merge rounds. Real crawl data converged in ≤ 7 rounds
 * on the two validation corpora (302 pages / 8,936 pages).
 */
const MAX_ROUNDS = 10;

/**
 * Segments carrying no structural information at L2 resolution.
 * Tokens whose only non-`main` content segments are all generic are excluded
 * from L2 signatures as uninformative.
 */
const GENERIC_SEGMENTS = new Set([
	'div',
	'span',
	'*',
	'script',
	'noscript',
	'style',
	'iframe',
	'a',
	'br',
	'img',
	'picture',
	'source',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Frequency-based token core of a group of member pages: a token must be
 * present in at least `QUORUM_FRACTION` of members to enter the core, with a
 * full-union fallback when no token clears that bar (see
 * {@link mergeCrossBlockClusters}'s JSDoc for why quorum beats strict
 * intersection or full union). Exported so callers building a `ClusterReason`
 * (`build-cluster-reason.ts`) can re-derive a final group's structural core
 * from `finalGroupsByRoot` without duplicating this logic.
 * @param memberDistinctiveTokens
 */
export function computeQuorumCore(
	memberDistinctiveTokens: readonly ReadonlySet<string>[],
): ReadonlySet<string> {
	const n = memberDistinctiveTokens.length;
	if (n === 0) return new Set();

	const minCount = Math.ceil(QUORUM_FRACTION * n);
	const tokenCount = new Map<string, number>();
	for (const tokens of memberDistinctiveTokens) {
		for (const token of tokens) {
			tokenCount.set(token, (tokenCount.get(token) ?? 0) + 1);
		}
	}

	const core = new Set<string>();
	for (const [token, count] of tokenCount) {
		if (count >= minCount) core.add(token);
	}

	if (core.size > 0) return core;

	// Fallback: union of all distinctive tokens (happens for very small units)
	const union = new Set<string>();
	for (const tokens of memberDistinctiveTokens) {
		for (const t of tokens) union.add(t);
	}
	return union;
}

/**
 * Minimum ratio a proposed merge's post-merge quorum-core size must retain,
 * relative to the strongest lineage anchor on either side (see
 * `anchorByRoot` in {@link filterMergesByCohesion}), or the merge is
 * discarded.
 *
 * Chosen against `merge-cross-block-clusters.spec.ts`'s own fixtures, which
 * bound both edges this value has to sit between:
 * - "a hub unit does not absorb several mutually-unrelated units via
 *   containment" needs a ratio *above* ~`0.3` to reject each absorption (the
 *   hub's own 10-token core collapses to the 3 tokens the absorbed unit
 *   happens to also carry).
 * - the bundled `buildMirroredTemplateFixture` fixture (see
 *   `resolve-page-cluster-keys.spec.ts`) needs a ratio *at or below* ~`0.8`
 *   to keep merging every one of its genuine per-mirror units (the same
 *   template, once per axis value) — above that, some legitimate mirrors
 *   stop merging because a handful of per-page module drops (this fixture's
 *   stand-in for optional-section variation) dip just far enough below a
 *   stricter bar.
 *
 * `0.7` sits with margin inside `(0.3, 0.8]` rather than against either
 * edge. This is a per-step ratio, not an absolute floor — see
 * `anchorByRoot`'s own JSDoc for why an anchor was needed at all, and for
 * the residual limitation neither the ratio nor the anchor fixes: many
 * originally-small-core units chained together one step at a time can each
 * individually clear this ratio against the previous step's *already-small*
 * anchor, so a long enough chain of naturally low-information pages can
 * still end up merged even though no single step looks anomalous. Longer
 * chains are exactly what {@link ./build-cluster-reason.js | ClusterReason}'s
 * `blocking` array length and
 * {@link ./compute-cluster-cohesion.js | computeClusterCohesion}'s
 * `suspicious` flag are for — this guard reduces how often that happens and
 * how far it goes, it does not claim to make it impossible.
 */
const MIN_COHESION_RATIO = 0.7;

/**
 * `computeQuorumCore` without its full-union fallback for empty cores. The
 * fallback exists so a final `ClusterReason.structuralCoreTokens` is never
 * empty for a genuinely tiny unit — but it makes core *size* useless as a
 * cohesion signal: a merge that destroys every token's 80% quorum would
 * silently read as "core size is now the size of the union", i.e. bigger,
 * not smaller. {@link filterMergesByCohesion} needs "zero tokens survive
 * quorum" to mean zero.
 * @param memberDistinctiveTokens
 */
function strictQuorumCoreSize(
	memberDistinctiveTokens: readonly ReadonlySet<string>[],
): number {
	const n = memberDistinctiveTokens.length;
	if (n === 0) return 0;

	const minCount = Math.ceil(QUORUM_FRACTION * n);
	const tokenCount = new Map<string, number>();
	for (const tokens of memberDistinctiveTokens) {
		for (const token of tokens) {
			tokenCount.set(token, (tokenCount.get(token) ?? 0) + 1);
		}
	}

	let coreSize = 0;
	for (const count of tokenCount.values()) {
		if (count >= minCount) coreSize++;
	}
	return coreSize;
}

/**
 * Filters a round's proposed `[absorbed, root]` merges, rejecting any merge
 * whose post-merge quorum core would collapse relative to the best core any
 * single original unit now pooled into either side ever had — the guard
 * against Stage B's fine/L2 stages successively absorbing unrelated units
 * into a "catch-all" whose core shrinks toward shell-only tokens with every
 * additional merge (each individual merge can look locally justified — the
 * pair's *pre-merge* cores still overlap enough to clear
 * `CROSS_BLOCK_THRESHOLD`/containment/L2 — while the *post-merge* core keeps
 * shrinking, which none of those pre-merge checks observe).
 *
 * ## Why an anchor, not just the immediately preceding step
 *
 * An earlier version compared each merge only against the pool as it stood
 * after the *previous* accepted merge for that root. That still lets a long
 * chain erode a core to nothing, one acceptable-looking step at a time: if
 * each step's ratio is checked only against the *result of the previous
 * step*, and each step dilutes the pool a little, the reference the ratio is
 * measured against keeps shrinking right along with the pool being measured
 * — nothing ever compares the current state back to where the lineage
 * started, so a chain of many individually-small erosions can compound into
 * a total collapse no single step's check would have allowed on its own.
 * `anchorByRoot` fixes this: every original unit's *own*, pre-any-merge core
 * size (`anchorCoreSizeByKey`, computed once before the round loop) is
 * carried forward — via `Math.max`, never re-derived from the current pool —
 * as units merge into a root, so every later merge attempt is still measured
 * against the strongest evidence its lineage ever had, not against
 * whatever the lineage has been diluted to by the time of the attempt.
 *
 * Merges proposed for the same root are applied incrementally, in the order
 * given, checking each one against the pool as it stood *after* the
 * previously accepted merges for that root, so a chain of merges within a
 * single call cannot each pass by being compared to a `pooled` state that
 * never reflects the merges already accepted earlier in the same call.
 *
 * Two things intentionally do not gate rejection alone:
 * - `strictQuorumCoreSize` is used instead of `computeQuorumCore`'s size —
 *   see that function's own JSDoc for why the fallback would invert the
 *   signal for exactly the merges this guard exists to catch.
 * - A merge whose post-merge core size is `0` is always rejected, even when
 *   the anchor was also `0` (which would make the ratio check
 *   `0 >= ratio * 0` vacuously pass) — otherwise a unit that already lost
 *   its own core would become a sink that absorbs anything with no further
 *   resistance.
 * @param proposedMerges `[absorbedKey, rootKey]` pairs, as produced by the
 *   fine or L2 stage's own union-find pass.
 * @param groupDistinctive This round's per-group distinctive token sets,
 *   keyed by group key. Callers pass the class-name-stripped
 *   `groupDistinctiveShaped` projection (see
 *   {@link mergeCrossBlockClusters}'s own body) rather than raw
 *   `groupDistinctive` — the fine stage's shape-Jaccard merges pair units
 *   with disjoint raw tokens by construction, and a cohesion check against
 *   raw tokens would reject every one of those merges outright.
 * @param anchorByRoot Every current root's strongest lineage core size (see
 *   above). Mutated in place: an accepted merge's root inherits
 *   `Math.max(root's anchor, absorbed's anchor)`.
 */
function filterMergesByCohesion(
	proposedMerges: readonly [string, string][],
	groupDistinctive: ReadonlyMap<string, readonly ReadonlySet<string>[]>,
	anchorByRoot: Map<string, number>,
): [string, string][] {
	const byRoot = new Map<string, string[]>();
	for (const [absorbed, root] of proposedMerges) {
		const list = byRoot.get(root);
		if (list) list.push(absorbed);
		else byRoot.set(root, [absorbed]);
	}

	const accepted: [string, string][] = [];
	for (const [root, absorbedKeys] of byRoot) {
		let pooled = [...(groupDistinctive.get(root) ?? [])];
		for (const absorbed of absorbedKeys) {
			const absorbedTokens = groupDistinctive.get(absorbed) ?? [];
			const candidatePool = [...pooled, ...absorbedTokens];
			const candidateCoreSize = strictQuorumCoreSize(candidatePool);
			const referenceCoreSize = Math.max(
				anchorByRoot.get(root) ?? strictQuorumCoreSize(pooled),
				anchorByRoot.get(absorbed) ?? strictQuorumCoreSize(absorbedTokens),
			);

			if (
				candidateCoreSize > 0 &&
				candidateCoreSize >= MIN_COHESION_RATIO * referenceCoreSize
			) {
				pooled = candidatePool;
				anchorByRoot.set(root, referenceCoreSize);
				anchorByRoot.delete(absorbed);
				accepted.push([absorbed, root]);
			}
		}
	}
	return accepted;
}

/**
 *
 * @param core
 */
function shapedCoreSet(core: ReadonlySet<string>): Set<string> {
	const shaped = new Set<string>();
	for (const token of core) shaped.add(shapeToken(token));
	return shaped;
}

/**
 *
 * @param core
 */
function l2Signature(core: ReadonlySet<string>): Map<string, number> | null {
	const counts = new Map<string, number>();
	for (const token of core) {
		const shaped = shapeToken(token);
		const segments = shaped.split('>');
		const mainIdx = segments.findIndex(
			(s) => s === 'main' || s.startsWith('main[') || s.startsWith('main.'),
		);
		if (mainIdx === -1) continue;

		// Take main + up to 2 levels after it
		const truncated = segments.slice(mainIdx, mainIdx + 3);
		const contentSegments = truncated.slice(1);

		// Skip if all content segments are generic (or none exist)
		if (contentSegments.every((s) => GENERIC_SEGMENTS.has(s))) {
			continue;
		}

		const key = truncated.join('>');
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts.size > 0 ? counts : null;
}

/**
 *
 * @param xSig
 * @param ySig
 */
function l2Contained(xSig: Map<string, number>, ySig: Map<string, number>): boolean {
	for (const [key, xCount] of xSig) {
		if (xCount > (ySig.get(key) ?? 0)) return false;
	}
	return true;
}

/**
 * Canonical id for an `l2Signature`'s *shape* — its key set, ignoring the
 * per-key counts — so {@link hasDiscriminatingL2Signatures} can tell whether
 * two units reduced to the same vocabulary of `main`-anchored shapes,
 * independent of how many pages contributed to each count.
 * @param signature
 */
function l2SignatureShapeId(signature: Map<string, number>): string {
	return [...signature.keys()].toSorted().join(' ');
}

/**
 * Minimum number of units an L2-degeneracy check requires before it will
 * reject the whole comparison — below this, "every unit shares one shape"
 * is unremarkable (there is nothing to discriminate between yet), not
 * evidence the signature itself lacks resolving power.
 */
const MIN_L2_PARTICIPANTS_FOR_DEGENERACY_CHECK = 3;

/**
 * Whether this round's L2 signatures carry any discriminating power at all,
 * checked once per round *before* running the `O(l2n²)` containment
 * comparison rather than discovering it empirically pair by pair.
 *
 * `l2Signature` truncates to `main` plus up to 2 shape-stripped levels (see
 * its own JSDoc); a corpus where the actual template content sits under a
 * shared `main > article > <wrapper>` chain collapses every unit's
 * signature to the exact same handful of keys (`main>article>*`, in the
 * bundled `buildMirroredTemplateFixture` fixture's own case — see
 * `merge-cross-block-clusters.spec.ts`), at which point `l2Contained`'s
 * multiset containment degenerates into a plain count comparison with no
 * structural meaning left. Rather than let that degenerate comparison run
 * (and rely solely on {@link filterMergesByCohesion} to catch whatever it
 * proposes), this is checked up front: if every participating unit reduces
 * to the *same* shape, the signature has already lost all resolving power
 * for this round, and comparing pairs is wasted work.
 *
 * Only total collapse (all participants share one shape) is detected —
 * partial collapse (e.g. 8 units reducing to 2 shapes that don't line up
 * with their true 8 templates) is not, and still relies on
 * {@link filterMergesByCohesion} downstream.
 * @param l2Keys
 * @param getL2Sig
 */
function hasDiscriminatingL2Signatures(
	l2Keys: readonly string[],
	getL2Sig: (key: string) => Map<string, number> | null,
): boolean {
	const shapeIds = new Set<string>();
	let participantCount = 0;
	for (const key of l2Keys) {
		const sig = getL2Sig(key);
		if (!sig) continue;
		participantCount++;
		shapeIds.add(l2SignatureShapeId(sig));
		if (shapeIds.size > 1) return true;
	}
	return participantCount < MIN_L2_PARTICIPANTS_FOR_DEGENERACY_CHECK;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * One root key's pooled member state after Stage B converges: every
 * `tokenSets`/`landmarkInstances` entry folded in from every unit merged into
 * this root (down-sampled to `capMembers` when the caller opts in, same as
 * during merging). This is the exact state `mergeCrossBlockClusters` already
 * builds internally to run quorum-core/shell comparisons each round — it was
 * discarded once `keyToRoot` was returned. Exposing it lets a `ClusterReason`
 * (`build-cluster-reason.ts`) be built from data Stage B already computed,
 * with no extra pass over the corpus.
 */
export type FinalGroupMembers = {
	readonly tokenSets: readonly ReadonlySet<string>[];
	readonly landmarkInstances: readonly (readonly PerPageLandmarkInstance[])[];
	/**
	 * Parallel to `tokenSets` — see {@link CrossBlockUnit}'s own
	 * `memberPageIndices`. An entry is `-1` for any member whose originating
	 * unit omitted `memberPageIndices`.
	 */
	readonly pageIndices: readonly number[];
};

/**
 * `mergeCrossBlockClusters`'s result: the root-key mapping every caller
 * needs for `clusterKey` resolution, plus each surviving root's final pooled
 * member state for callers that also want to explain *why* (`ClusterReason`).
 */
export type MergeCrossBlockClustersResult = {
	/** Every input unit's `key` mapped to its final root key. Units not absorbed into any other unit map to themselves. */
	readonly rootByKey: ReadonlyMap<string, string>;
	/** Every surviving root key's final pooled member state. */
	readonly finalGroupsByRoot: ReadonlyMap<string, FinalGroupMembers>;
};

/**
 * Merges cross-block clusters (Stage B) via recursive quorum-core comparison.
 *
 * Returns the root-key mapping (see {@link MergeCrossBlockClustersResult}).
 * Units not absorbed into any other unit map to themselves.
 *
 * Three merge mechanisms run per round, in order:
 * 1. **Fine stage** — complete-linkage at `CROSS_BLOCK_THRESHOLD` on quorum
 *    cores, then containment assignment (0.9), then shape-Jaccard (0.9) for
 *    class-name-only differences.
 * 2. **L2 stage** (only when fine found nothing) — multiset containment on
 *    `main`-anchored 2-level shape signatures, with shell corroboration
 *    (header+nav+footer quorum Jaccard ≥ 0.8) required.
 *
 * Rounds continue until neither stage finds anything, or `MAX_ROUNDS` is hit.
 * Each round re-derives quorum cores from pooled members of merged units.
 *
 * Why quorum cores instead of strict intersection or full union:
 * strict intersection degenerated on real crawl data (89 articles → 1 shared
 * distinctive token → jaccard 1.0 false merges). Full union was shell-dominated
 * (298-page avalanche into 4 clusters). Both failure modes are documented in
 * `@d-zero/page-cluster` source JSDoc; quorum 80% + page-frequency shell
 * removal was validated on two real crawl corpora.
 * @param units Post-Stage-A clusters.
 * @param options Forwarded `similarityThreshold` (defaults to 0.8).
 * @param options.similarityThreshold
 * @param options.capMembers
 */
export function mergeCrossBlockClusters(
	units: readonly CrossBlockUnit[],
	options?: {
		similarityThreshold?: number;
		/**
		 * Opt-in post-merge cap on a group's retained member count. When
		 * set, each merged group is reservoir-sampled back down to this
		 * cap after every merge so a chain of merges cannot balloon past
		 * the per-unit cap Stage A applied at creation. Callers on the
		 * streaming path pass the same value as `capMembers` used in
		 * Stage A; the in-memory path omits it so validated corpora keep
		 * full-membership merge behavior unchanged.
		 */
		capMembers?: number;
	},
): MergeCrossBlockClustersResult {
	if (units.length <= 1) {
		return {
			rootByKey: new Map(units.map((u) => [u.key, u.key])),
			finalGroupsByRoot: new Map(
				units.map((u) => [
					u.key,
					{
						tokenSets: u.memberTokenSets,
						landmarkInstances: u.memberLandmarkInstances,
						pageIndices: u.memberPageIndices ?? u.memberTokenSets.map(() => -1),
					},
				]),
			),
		};
	}

	const threshold = options?.similarityThreshold ?? CROSS_BLOCK_THRESHOLD;
	const capMembers = options?.capMembers;

	// Mutable group state: rootKey → combined member arrays
	type GroupMembers = {
		tokenSets: ReadonlySet<string>[];
		landmarkInstances: (readonly PerPageLandmarkInstance[])[];
		pageIndices: number[];
	};

	const groups = new Map<string, GroupMembers>();
	for (const unit of units) {
		groups.set(unit.key, {
			tokenSets: [...unit.memberTokenSets],
			landmarkInstances: [...unit.memberLandmarkInstances],
			pageIndices: [...(unit.memberPageIndices ?? unit.memberTokenSets.map(() => -1))],
		});
	}

	// Maps every original key to its current root (updated on each merge)
	const keyToRoot = new Map<string, string>(units.map((u) => [u.key, u.key]));

	// Each unit's own pre-any-merge core size, carried forward by
	// `filterMergesByCohesion` as units merge — see that function's own
	// JSDoc for why an anchor is needed at all. Computed the same way round
	// 1's own `groupDistinctiveShaped` would (document frequency over the
	// full initial unit set, then class-name-stripped), so a solo unit's
	// anchor matches what the very first round would already compute for it.
	const initialFrequency = computeDocumentFrequency(
		units.flatMap((u) => u.memberTokenSets),
	);
	const anchorByRoot = new Map<string, number>(
		units.map((u) => {
			const distinctiveShaped = u.memberTokenSets.map((tokens) => {
				const { contentTokens } = splitTokensByFrequency(tokens, initialFrequency);
				const distinctive = contentTokens.size > 0 ? contentTokens : tokens;
				return new Set([...distinctive].map((t) => shapeToken(t)));
			});
			return [u.key, strictQuorumCoreSize(distinctiveShaped)];
		}),
	);

	/**
	 * Applies a list of [absorbed, root] merges to `groups` and `keyToRoot`.
	 * All absorbed groups' members are folded into their respective roots.
	 * @param merges
	 */
	function applyMerges(merges: readonly [string, string][]): void {
		for (const [absorbed, root] of merges) {
			const absorbedG = groups.get(absorbed);
			const rootG = groups.get(root);
			if (!absorbedG || !rootG) continue;

			const mergedTokenSets = [...rootG.tokenSets, ...absorbedG.tokenSets];
			const mergedLandmarkInstances = [
				...rootG.landmarkInstances,
				...absorbedG.landmarkInstances,
			];
			const mergedPageIndices = [...rootG.pageIndices, ...absorbedG.pageIndices];
			// Only down-sample when the caller explicitly opts in (streaming
			// path). Same-index sampling keeps memberTokenSets[i],
			// landmarkInstances[i], and pageIndices[i] parallel.
			if (capMembers !== undefined && mergedTokenSets.length > capMembers) {
				const indices = mergedTokenSets.map((_, i) => i);
				const kept = reservoirSample(indices, capMembers, root);
				rootG.tokenSets = kept.map((i) => mergedTokenSets[i]!);
				rootG.landmarkInstances = kept.map((i) => mergedLandmarkInstances[i]!);
				rootG.pageIndices = kept.map((i) => mergedPageIndices[i]!);
			} else {
				rootG.tokenSets = mergedTokenSets;
				rootG.landmarkInstances = mergedLandmarkInstances;
				rootG.pageIndices = mergedPageIndices;
			}
			groups.delete(absorbed);

			for (const [origKey, cur] of keyToRoot) {
				if (cur === absorbed) keyToRoot.set(origKey, root);
			}
			keyToRoot.set(absorbed, root);
		}
	}

	for (let round = 0; round < MAX_ROUNDS; round++) {
		const groupKeys = [...groups.keys()];
		const n = groupKeys.length;
		if (n <= 1) break;

		// ---------------------------------------------------------------
		// Compute corpus distinctive tokens (page-frequency shell removal)
		// ---------------------------------------------------------------
		const allPageTokenSets = groupKeys.flatMap((k) => groups.get(k)!.tokenSets);
		const corpusFrequency = computeDocumentFrequency(allPageTokenSets);

		const groupDistinctive = new Map<string, ReadonlySet<string>[]>();
		for (const key of groupKeys) {
			const g = groups.get(key)!;
			const dist: ReadonlySet<string>[] = [];
			for (const tokens of g.tokenSets) {
				const { contentTokens } = splitTokensByFrequency(tokens, corpusFrequency);
				dist.push(contentTokens.size > 0 ? contentTokens : tokens);
			}
			groupDistinctive.set(key, dist);
		}

		// Class-name-stripped projection of `groupDistinctive`, for
		// {@link filterMergesByCohesion} only: the fine stage's own
		// shape-Jaccard step (below) merges units whose *raw* tokens are
		// disjoint by construction (same skeleton, different BEM class
		// names — see `SHAPE_JACCARD_THRESHOLD`'s JSDoc), so a cohesion check
		// against raw tokens would reject every shape-Jaccard merge outright.
		// Shaping first lets the guard see that 'section.c-reports' and
		// 'section.c-projects' both contribute to a shared 'section' token.
		const groupDistinctiveShaped = new Map<string, ReadonlySet<string>[]>();
		for (const [key, dist] of groupDistinctive) {
			groupDistinctiveShaped.set(
				key,
				dist.map((tokens) => new Set([...tokens].map((t) => shapeToken(t)))),
			);
		}

		// Quorum core per group
		const cores = new Map<string, ReadonlySet<string>>();
		for (const key of groupKeys) {
			cores.set(key, computeQuorumCore(groupDistinctive.get(key) ?? []));
		}

		// ---------------------------------------------------------------
		// Fine stage: union-find over group indices
		// ---------------------------------------------------------------
		const parent = Array.from({ length: n }, (_, i) => i);
		const ufFind = (x: number): number => {
			let r = x;
			while (parent[r] !== r) r = parent[r]!;
			let c = x;
			while (c !== r) {
				const next = parent[c]!;
				parent[c] = r;
				c = next;
			}
			return r;
		};
		const ufUnion = (a: number, b: number): void => {
			const ra = ufFind(a);
			const rb = ufFind(b);
			if (ra !== rb) parent[rb] = ra; // lower index wins
		};

		const coreSets = groupKeys.map(
			(k) => cores.get(k) ?? (new Set<string>() as ReadonlySet<string>),
		);

		// Step 1: CL merges
		const dendrogram = completeLinkageDendrogram(coreSets);
		const clLabels = labelsAtThreshold(n, dendrogram, threshold);
		for (let i = 0; i < n; i++) {
			const r = clLabels[i];
			if (r !== undefined && r !== i) ufUnion(r, i);
		}

		// Step 2: Containment on the current union-find clusters
		// Build union token set per UF cluster
		const clusterUnion = new Map<number, Set<string>>();
		const clusterPageCount = new Map<number, number>();
		for (let i = 0; i < n; i++) {
			const r = ufFind(i);
			let u = clusterUnion.get(r);
			if (!u) {
				u = new Set();
				clusterUnion.set(r, u);
			}
			for (const t of coreSets[i] ?? []) u.add(collapseAnonymousDivs(t));
			clusterPageCount.set(
				r,
				(clusterPageCount.get(r) ?? 0) +
					(groups.get(groupKeys[i] ?? '')?.tokenSets.length ?? 0),
			);
		}
		const contEntries = [...clusterUnion.entries()].map(([id, tokens]) => ({
			id,
			tokens: tokens as ReadonlySet<string>,
			pageCount: clusterPageCount.get(id) ?? 0,
		}));
		const contResult = assignContainedClusters(contEntries);
		// Apply containment assignment: fromId (UF root index) → toId (UF root index)
		for (const [fromId, toId] of contResult) {
			if (fromId === toId) continue;
			// fromId/toId are group indices (the UF roots when contEntries was built)
			ufUnion(toId, fromId);
		}

		// Step 3: Shape-Jaccard (multi-page units only — see SHAPE_MIN_PAGES)
		const shapedCores = groupKeys.map((k) => shapedCoreSet(cores.get(k) ?? new Set()));
		const groupPageCounts = groupKeys.map((k) => groups.get(k)?.tokenSets.length ?? 0);
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				if (ufFind(i) === ufFind(j)) continue;
				if (
					(groupPageCounts[i] ?? 0) < SHAPE_MIN_PAGES ||
					(groupPageCounts[j] ?? 0) < SHAPE_MIN_PAGES
				) {
					continue;
				}
				const si = shapedCores[i] ?? new Set<string>();
				const sj = shapedCores[j] ?? new Set<string>();
				if (jaccardSimilarity(si, sj) >= SHAPE_JACCARD_THRESHOLD) {
					ufUnion(ufFind(i), ufFind(j));
				}
			}
		}

		// Collect fine-stage merges: groups that share a UF root
		const rootToFirstKey = new Map<number, string>(); // UF root → first group key (alphabetically first)
		const fineMerges: [string, string][] = [];
		for (let i = 0; i < n; i++) {
			const r = ufFind(i);
			const gk = groupKeys[i] ?? '';
			const rootKey = rootToFirstKey.get(r);
			if (rootKey === undefined) {
				rootToFirstKey.set(r, gk);
			} else {
				fineMerges.push([gk, rootKey]);
			}
		}

		const acceptedFineMerges = filterMergesByCohesion(
			fineMerges,
			groupDistinctiveShaped,
			anchorByRoot,
		);
		if (acceptedFineMerges.length > 0) {
			applyMerges(acceptedFineMerges);
			continue; // next round
		}

		// ---------------------------------------------------------------
		// L2 stage: multiset containment + shell corroboration
		// ---------------------------------------------------------------
		const l2Keys = [...groups.keys()];
		const l2n = l2Keys.length;
		if (l2n <= 1) break;

		// Lazily compute L2 sigs and shell quorums
		const l2SigCache = new Map<string, Map<string, number> | null>();
		const shellCache = new Map<string, ReadonlySet<string>>();

		const getL2Sig = (key: string): Map<string, number> | null => {
			if (!l2SigCache.has(key)) {
				l2SigCache.set(key, l2Signature(cores.get(key) ?? new Set()));
			}
			return l2SigCache.get(key) ?? null;
		};

		const getShell = (key: string): ReadonlySet<string> => {
			if (!shellCache.has(key)) {
				shellCache.set(key, shellQuorum(groups.get(key)?.landmarkInstances ?? []));
			}
			return shellCache.get(key) ?? new Set();
		};

		if (!hasDiscriminatingL2Signatures(l2Keys, getL2Sig)) break;

		// Collect valid L2 containment pairs and apply via union-find
		// Direction: x is contained in y → x is absorbed by y
		// Multiple pairs can apply in one round if they form consistent groups
		const l2Parent = Array.from({ length: l2n }, (_, i) => i);
		const l2Find = (x: number): number => {
			let r = x;
			while (l2Parent[r] !== r) r = l2Parent[r]!;
			let c = x;
			while (c !== r) {
				const next = l2Parent[c]!;
				l2Parent[c] = r;
				c = next;
			}
			return r;
		};
		const l2Union = (a: number, b: number): void => {
			const ra = l2Find(a);
			const rb = l2Find(b);
			if (ra !== rb) l2Parent[rb] = ra;
		};

		for (let xi = 0; xi < l2n; xi++) {
			const xKey = l2Keys[xi] ?? '';
			const xSig = getL2Sig(xKey);
			if (!xSig) continue;

			for (let yi = 0; yi < l2n; yi++) {
				if (xi === yi || l2Find(xi) === l2Find(yi)) continue;
				const yKey = l2Keys[yi] ?? '';
				const ySig = getL2Sig(yKey);
				if (!ySig) continue;
				if (!l2Contained(xSig, ySig)) continue;

				// Shell corroboration
				const xShell = getShell(xKey);
				const yShell = getShell(yKey);
				if (
					xShell.size === 0 ||
					yShell.size === 0 ||
					jaccardSimilarity(xShell, yShell) < SHELL_CORROBORATION_THRESHOLD
				) {
					continue;
				}

				// x absorbed by y: l2Parent[xi] = yi after l2Union
				l2Union(yi, xi);
				break; // xSig is stale once merged; let the next round re-evaluate
			}
		}

		const l2RootToFirst = new Map<number, string>();
		const l2Merges: [string, string][] = [];
		for (let i = 0; i < l2n; i++) {
			const r = l2Find(i);
			const gk = l2Keys[i] ?? '';
			const rootKey = l2RootToFirst.get(r);
			if (rootKey === undefined) {
				l2RootToFirst.set(r, gk);
			} else {
				l2Merges.push([gk, rootKey]);
			}
		}

		const acceptedL2Merges = filterMergesByCohesion(
			l2Merges,
			groupDistinctiveShaped,
			anchorByRoot,
		);
		if (acceptedL2Merges.length === 0) break; // fully converged (or every proposal was rejected)

		applyMerges(acceptedL2Merges);
	}

	const finalGroupsByRoot = new Map<string, FinalGroupMembers>(
		[...groups.entries()].map(([root, g]) => [
			root,
			{
				tokenSets: g.tokenSets,
				landmarkInstances: g.landmarkInstances,
				pageIndices: g.pageIndices,
			},
		]),
	);
	return { rootByKey: keyToRoot, finalGroupsByRoot };
}
