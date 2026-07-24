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
					{ tokenSets: u.memberTokenSets, landmarkInstances: u.memberLandmarkInstances },
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
	};

	const groups = new Map<string, GroupMembers>();
	for (const unit of units) {
		groups.set(unit.key, {
			tokenSets: [...unit.memberTokenSets],
			landmarkInstances: [...unit.memberLandmarkInstances],
		});
	}

	// Maps every original key to its current root (updated on each merge)
	const keyToRoot = new Map<string, string>(units.map((u) => [u.key, u.key]));

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
			// Only down-sample when the caller explicitly opts in (streaming
			// path). Same-index sampling keeps memberTokenSets[i] and
			// landmarkInstances[i] parallel.
			if (capMembers !== undefined && mergedTokenSets.length > capMembers) {
				const indices = mergedTokenSets.map((_, i) => i);
				const kept = reservoirSample(indices, capMembers, root);
				rootG.tokenSets = kept.map((i) => mergedTokenSets[i]!);
				rootG.landmarkInstances = kept.map((i) => mergedLandmarkInstances[i]!);
			} else {
				rootG.tokenSets = mergedTokenSets;
				rootG.landmarkInstances = mergedLandmarkInstances;
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

		if (fineMerges.length > 0) {
			applyMerges(fineMerges);
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

		if (l2Merges.length === 0) break; // fully converged

		applyMerges(l2Merges);
	}

	const finalGroupsByRoot = new Map<string, FinalGroupMembers>(
		[...groups.entries()].map(([root, g]) => [
			root,
			{ tokenSets: g.tokenSets, landmarkInstances: g.landmarkInstances },
		]),
	);
	return { rootByKey: keyToRoot, finalGroupsByRoot };
}
