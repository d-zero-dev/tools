import type { ExtractLandmarksResult } from './extract-landmarks.js';
import type { CrossBlockUnit } from './merge-cross-block-clusters.js';
import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { autoCutThreshold } from './auto-cut-threshold.js';
import { capContentDepth } from './cap-content-depth.js';
import {
	detectContentDepthCap,
	validateDetectContentDepthCapOptions,
} from './detect-content-depth-cap.js';
import { extractLandmarks } from './extract-landmarks.js';
import { filterFirstPartyStylesheetHrefs } from './filter-first-party-stylesheet-hrefs.js';
import { jaccardSimilarity } from './jaccard-similarity.js';
import { mergeCrossBlockClusters } from './merge-cross-block-clusters.js';
import { groupIndicesByBlockKey, resolveBlockKeys } from './pass0-blocking.js';
import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';
import { removeContentBlocks } from './remove-content-blocks.js';
import { stageAPerBlock } from './stage-a-per-block.js';
import { tokenize } from './tokenize.js';

/**
 * FNV-1a 32-bit hash of a string, used to seed the per-block PRNG so
 * reservoir sampling on the streaming path is deterministic for a given
 * corpus (same input order → same sampled indices → same cluster keys).
 * @param input
 */
function fnv1a32(input: string): number {
	let hash = 0x81_1c_9d_c5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.codePointAt(i) ?? 0;
		hash = Math.imul(hash, 0x01_00_01_93);
	}
	return hash >>> 0;
}

/**
 * Mulberry32 — small, well-known 32-bit PRNG. Kept independent per block
 * (each block seeds from its own block key via {@link ./resolve-page-cluster-keys.js | fnv1a32})
 * so different blocks sample independently.
 * @param seed
 */
function makeSeededPrng(seed: number | string): () => number {
	let state = (typeof seed === 'string' ? fnv1a32(seed) : seed) >>> 0;
	return () => {
		state = (state + 0x6d_2b_79_f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * Tokenizes a non-sample page using the block's learned parameters
 * (`maxMainDepth` and local-signature reinjection set) and returns the
 * key of the sample-derived cluster whose members it most closely matches
 * by Jaccard similarity. Ties break in first-seen order (JS `Map`
 * iteration). Falls back to a block-scoped singleton key when the block
 * has no clusters at all (edge case: an empty sample, which shouldn't
 * happen for a non-empty block but is defended against here).
 * @param html
 * @param assignment
 * @param assignment.maxMainDepth
 * @param assignment.localSignatures
 * @param assignment.clustersByUnitKey
 * @param excludeLandmarks
 * @param contentBlockAttribute
 * @param tokenizeOptions
 * @param blockKey
 */
function assignPageToNearestCluster(
	html: string,
	assignment: {
		readonly maxMainDepth: number | undefined;
		readonly localSignatures: ReadonlySet<string>;
		readonly clustersByUnitKey: ReadonlyMap<string, readonly ReadonlySet<string>[]>;
	},
	excludeLandmarks: boolean,
	contentBlockAttribute: string | undefined,
	tokenizeOptions: TokenizeOptions | undefined,
	blockKey: string,
): string {
	const landmarkResult = extractLandmarks(html);
	const landmarksExcised = excludeLandmarks ? landmarkResult.remainderHtml : html;
	let prepared =
		contentBlockAttribute === undefined
			? landmarksExcised
			: removeContentBlocks(landmarksExcised, { blockAttribute: contentBlockAttribute })
					.remainderHtml;
	if (assignment.maxMainDepth !== undefined) {
		prepared = capContentDepth(prepared, {
			landmark: 'main',
			maxDepth: assignment.maxMainDepth,
		}).remainderHtml;
	}

	const pageTokens = new Set(tokenize(prepared, tokenizeOptions).tokens);
	// Reinject tokens for landmark instances whose signature matches the
	// block's learned local-signature set (same rule the sample-side Stage
	// A applied via computeLocalChromeArtifacts).
	if (assignment.localSignatures.size > 0) {
		const instances = computePerPageLandmarkInstances(
			[landmarkResult],
			tokenizeOptions,
		)[0]!;
		for (const inst of instances) {
			if (!assignment.localSignatures.has(inst.signature)) continue;
			for (const t of inst.tokens) pageTokens.add(t);
		}
	}

	let bestKey: string | undefined;
	let bestScore = -1;
	for (const [unitKey, memberTokenSets] of assignment.clustersByUnitKey) {
		let clusterBest = 0;
		for (const memberTokens of memberTokenSets) {
			const score = jaccardSimilarity(pageTokens, memberTokens);
			if (score > clusterBest) clusterBest = score;
		}
		if (clusterBest > bestScore) {
			bestScore = clusterBest;
			bestKey = unitKey;
		}
	}
	return bestKey ?? JSON.stringify([blockKey, 'cluster:unassigned']);
}

/**
 * Reinjects each page's *local* (non-corpus-wide) landmark-instance tokens
 * into its block token set for Stage A clustering, restoring exactly the
 * structural signal that landmark excision removed for those pages while
 * keeping global chrome removed (the whole point of `excludeLandmarks`).
 *
 * ## Why token-level reinjection instead of one opaque pseudo-token
 *
 * An earlier iteration returned a single opaque token per local signature.
 * That failed on real data: adding one distinctive token to a 100+-token
 * page's set produces jaccard ~0.99 between "with-local-landmark" and
 * "without-local-landmark" siblings, so Stage A's 0.8-clamped auto-cut
 * silently merged them anyway. Reinjecting the landmark's actual tokens
 * (typically 4–20 per landmark) restores the full structural weight of
 * the distinction. A real mid-sized crawl corpus's section subtree with
 * a shared section-local `<nav>` now splits correctly from siblings
 * without one, since the reinjected local-nav tokens push jaccard below
 * the cut.
 *
 * ## The corpus-level auto-cut
 *
 * Every page's landmark instances are canonicalized to a signature (via
 * {@link ./canonicalize-token-set.js | canonicalizeTokenSet}); the corpus-
 * wide histogram of "how many pages carry this signature" is fed to
 * {@link ./auto-cut-threshold.js | autoCutThreshold} — the same primitive
 * used at every other layer of this pipeline for merge-height cutoffs. The
 * clamp caps the auto-cut at 0.8 so it never picks a threshold *above* the
 * conservative default. A signature at or above the cut is global chrome —
 * appears on effectively every page, so its tokens carry no discriminatory
 * signal and are left excised. A signature below the cut is local chrome
 * for the pages that carry it, and its tokens are reinjected into those
 * pages' block token sets. Same technique as the per-unit shellQuorum in
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}, one
 * layer up.
 *
 * ## The `count >= 2` gate
 *
 * A signature present on exactly one page is per-page variation, not
 * shared local chrome — no "these pages have the same local chrome, those
 * pages don't" grouping can be built from a singleton, and admitting
 * singleton signatures would reinject each per-page-unique landmark into
 * exactly one page's token set, causing spurious per-page cluster
 * fragmentation across the corpus (confirmed against a 2-page fixture
 * where two pages carry byte-different `<header>`s produced identical
 * clusters as expected; without the gate, each would carry its own
 * reinjected tokens and split).
 * @param landmarks
 * @param tokenizeOptions
 */
/**
 * Companion to {@link ./resolve-page-cluster-keys.js | computeLocalLandmarkTokens}
 * that also returns the local-signature *set* the streaming path needs to
 * reuse when tokenizing non-sample pages during Pass 1b. The in-memory path
 * only cares about the per-page token sets (which pages carry which
 * chrome-below-the-cut tokens); the streaming path additionally needs to
 * apply the *same* "which signatures are local" verdict to pages that were
 * not part of the sample the verdict was learned from.
 * @param landmarks
 * @param tokenizeOptions
 */
export function computeLocalChromeArtifacts(
	landmarks: readonly ExtractLandmarksResult[],
	tokenizeOptions: TokenizeOptions | undefined,
): {
	readonly localSignatures: ReadonlySet<string>;
	readonly localTokensByPage: readonly ReadonlySet<string>[];
} {
	const pageCount = landmarks.length;
	if (pageCount === 0) return { localSignatures: new Set(), localTokensByPage: [] };

	const perPageInstances = computePerPageLandmarkInstances(landmarks, tokenizeOptions);

	// Corpus-wide histogram: signature → { count, tokens }. tokens is the
	// token set of any one occurrence of the signature (all occurrences are
	// equal by construction).
	const corpusHistogram = new Map<
		string,
		{ count: number; tokens: ReadonlySet<string> }
	>();
	for (const instances of perPageInstances) {
		for (const inst of instances) {
			const entry = corpusHistogram.get(inst.signature);
			if (entry) {
				entry.count++;
			} else {
				corpusHistogram.set(inst.signature, { count: 1, tokens: inst.tokens });
			}
		}
	}
	if (corpusHistogram.size === 0) {
		return {
			localSignatures: new Set(),
			localTokensByPage: landmarks.map(() => new Set<string>()),
		};
	}

	const frequencies: number[] = [];
	for (const entry of corpusHistogram.values()) {
		frequencies.push(entry.count / pageCount);
	}
	const cut = autoCutThreshold(frequencies, 0.8);

	// Signatures whose tokens we'll reinject: below cut, non-singleton.
	const localSignatures = new Set<string>();
	for (const [sig, entry] of corpusHistogram) {
		if (entry.count >= 2 && entry.count / pageCount < cut) {
			localSignatures.add(sig);
		}
	}
	if (localSignatures.size === 0) {
		return {
			localSignatures: new Set(),
			localTokensByPage: landmarks.map(() => new Set<string>()),
		};
	}

	const localTokensByPage = perPageInstances.map((instances) => {
		const out = new Set<string>();
		for (const inst of instances) {
			if (!localSignatures.has(inst.signature)) continue;
			for (const token of inst.tokens) out.add(token);
		}
		return out;
	});

	return { localSignatures, localTokensByPage };
}

/**
 * Reinjects each page's *local* (non-corpus-wide) landmark-instance tokens
 * into its block token set for Stage A clustering, restoring exactly the
 * structural signal that landmark excision removed for those pages while
 * keeping global chrome removed (the whole point of `excludeLandmarks`).
 *
 * See {@link ./resolve-page-cluster-keys.js | computeLocalChromeArtifacts}
 * for the underlying algorithm — this function is a thin wrapper that
 * discards the local-signature set, exposed for callers that only need the
 * per-page tokens (the in-memory driver's use case).
 * @param landmarks
 * @param tokenizeOptions
 */
export function computeLocalLandmarkTokens(
	landmarks: readonly ExtractLandmarksResult[],
	tokenizeOptions: TokenizeOptions | undefined,
): ReadonlySet<string>[] {
	return [...computeLocalChromeArtifacts(landmarks, tokenizeOptions).localTokensByPage];
}

/**
 * Per-page input to {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}:
 * the blocking signals {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * needs, plus the page's raw HTML.
 */
export type PageClusterSignals = {
	paths: readonly string[];
	stylesheetHrefs: readonly string[];
	html: string;
	/**
	 * This page's own URL host (hostname, optionally `:port` — same shape as
	 * `new URL(pageUrl).host`), forwarded to
	 * {@link ./filter-first-party-stylesheet-hrefs.js | filterFirstPartyStylesheetHrefs}
	 * so it can judge that page's `stylesheetHrefs` by direct comparison
	 * instead of inferring a batch-wide dominant host.
	 */
	host?: string;
};

/**
 * Progress event emitted by the async factory-based
 * `resolvePageClusterKeys` when an `onProgress` callback is provided. Meant
 * as a lightweight, opt-in observability hook for callers who need visible
 * progress on multi-minute jobs — the CLI wires this straight to stderr.
 *
 * The event is a discriminated union on `phase`:
 * - `pass0-signals`: streaming path only. Reading blocking signals (paths /
 *   stylesheetHrefs / host) from the factory. Fires every ~1,000 pages
 *   during Pass 0.
 * - `pass1-block-complete`: one block's Stage A finished. Fires on **both**
 *   the small-corpus path (`≤ CORPUS_INLINE_THRESHOLD`, once per block in
 *   `indicesByBlockKey` iteration order) and the streaming path (once per
 *   block as its reservoir fills). The event carries the block's key and a
 *   running count of how many blocks have completed so far.
 * - `pass1b-assign`: streaming path only. Streaming assignment of
 *   non-sample pages is in progress. Fires every ~1,000 pages of Pass 1b.
 *   Conceptually absent on the small-corpus path — every page is a "sample"
 *   there.
 * - `stage-b-start`: cross-block merge has begun. Fires once per call on
 *   both paths.
 *
 * Stage B does not currently emit per-round events — a future extension
 * that passes a callback down into `mergeCrossBlockClusters` can add them
 * without breaking the existing shape.
 *
 * The **sync** `resolvePageClusterKeysInMemory` never emits any progress
 * (it has no way to yield to a caller mid-block anyway). Only the async
 * factory-based entry point participates in `onProgress`.
 */
export type ProgressEvent =
	| { readonly phase: 'pass0-signals'; readonly pagesSeen: number }
	| {
			readonly phase: 'pass1-block-complete';
			readonly blockKey: string;
			readonly blocksProcessed: number;
			readonly totalBlocks: number;
	  }
	| {
			readonly phase: 'pass1b-assign';
			readonly pagesAssigned: number;
			readonly pagesToAssign: number;
	  }
	| { readonly phase: 'stage-b-start'; readonly unitCount: number };

/**
 * @see resolvePageClusterKeys
 */
export type ResolvePageClusterKeysOptions = TokenizeOptions &
	ResolveBlockingGroupKeysOptions &
	ResolveStructuralClusterKeysOptions & {
		excludeLandmarks?: boolean;
		reassignOrphans?: boolean;
		contentBlockAttribute?: string;
		restrictStylesheetsToFirstParty?: boolean;
		/**
		 * Optional observability hook — invoked at every progress event
		 * documented on {@link ./resolve-page-cluster-keys.js | ProgressEvent}.
		 * Fires only on the async factory-based `resolvePageClusterKeys`;
		 * the sync `resolvePageClusterKeysInMemory` never emits events.
		 * On the async path, passing this option promotes the small-corpus
		 * branch (`≤ CORPUS_INLINE_THRESHOLD`) from delegating to the
		 * sync helper to running a per-block async loop that emits
		 * `pass1-block-complete` and `stage-b-start`. Omitting `onProgress`
		 * keeps the small-corpus branch on the pre-refactor sync path with
		 * zero yield overhead.
		 */
		onProgress?: (event: ProgressEvent) => void;
	};

/**
 * Corpus size at or below which the async factory-based
 * `resolvePageClusterKeys` reads the entire input into an array and delegates
 * to {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeysInMemory}
 * unchanged — preserving corpus-wide semantics (chrome discovery, Stage B
 * across all pages) exactly.
 *
 * Above this threshold, the streaming path takes over: block dispatch during
 * a second factory read, per-block chrome discovery (semantic drift from
 * corpus-wide, unavoidable when the whole corpus does not fit in memory),
 * and Stage B fed with the incrementally-accumulated cross-block units.
 *
 * Chosen from Phase 0 spike measurements: a ~9,000-page real crawl (biggest
 * block ~3,900) completed in ~108s / 1.25 GB heap on the in-memory path.
 * Doubling that headroom to 20,000 keeps every corpus previously validated
 * (302, 1,416, 8,936, 89 pages) on the exact code path they were validated
 * against, so their gate values (9 / 21 / 63 / 3 clusters respectively)
 * remain byte-reproducible. A ~176,000-page real crawl OOM'd on the in-memory
 * path well below this threshold worth of pages ever being materialized, so
 * anything above 20,000 is routed to streaming.
 */
export const CORPUS_INLINE_THRESHOLD = 20_000;

/**
 * Reservoir-sample size per block on the streaming path. Blocks larger than
 * this have Stage A run on a random sample of `BLOCK_SAMPLE_SIZE` pages,
 * with the remaining non-sample pages assigned via Jaccard similarity to
 * the sample-derived clusters during Pass 1b. Blocks at or below this size
 * still work — the sampling degenerates to "keep every input page unchanged"
 * per the `reservoirSample` contract, so small blocks behave identically to
 * the in-memory path.
 *
 * Chosen to bound accumulated Stage-B state: units × sample_size × per-
 * member memory ≈ 200 units × 100 members × 25 KB ≈ 500 MB, well within an
 * 8 GB Node heap even on macOS where jetsam (the kernel OOM killer) reacts
 * to RSS pressure before V8's own heap limit trips.
 *
 * ## Semantic differences from the in-memory path
 *
 * - **Chrome discovery is sample-based per block.** Landmark signatures that
 *   are rare in the sample get treated as global chrome; only signatures
 *   that show up on ≥ 2 sample members and below the sample-derived
 *   auto-cut are reinjected. Full-block chrome discovery would see rare
 *   signatures too — the sample-based decision approximates it.
 * - **Non-sample pages are assigned by max-Jaccard against sample member
 *   token sets.** A page whose closest sample member is genuinely dissimilar
 *   still gets slotted into the least-bad cluster; this is a pragmatic
 *   trade for a bounded assignment cost (no unbounded "outlier" cluster
 *   growth).
 * - **Stage B sees the sample-based `CrossBlockUnit`s only.** Non-sample
 *   pages carry the final key that Stage B produces for their assigned
 *   sample cluster, without contributing to Stage B's own DF / quorum-core
 *   / shell-quorum computations.
 *
 * Preserves the in-memory path unchanged for corpora at or below
 * {@link CORPUS_INLINE_THRESHOLD} — sampling is streaming-mode only.
 */
export const BLOCK_SAMPLE_SIZE = 100;

/**
 * Preserves the previous synchronous, array-in / array-out API of
 * `resolvePageClusterKeys` under a new name so the factory-based async
 * export can take the primary name while callers that already had a
 * materialized page array (spec tests, the in-repo dogfood harness,
 * downstream code that hasn't switched to streaming yet) retain the
 * exact same behavior.
 *
 * Semantics: identical to the pre-refactor `resolvePageClusterKeys`.
 * Corpus-wide chrome discovery, Stage B across every page, no memory
 * bound — meant to be called on inputs already known to fit in memory.
 * The async factory-based export delegates here whenever
 * `pages.length ≤ CORPUS_INLINE_THRESHOLD`, guaranteeing existing corpora
 * hit exactly this code path.
 * @param pages
 * @param options
 */
export function resolvePageClusterKeysInMemory(
	pages: readonly PageClusterSignals[],
	options?: ResolvePageClusterKeysOptions,
): string[] {
	const excludeLandmarks = options?.excludeLandmarks ?? true;

	const similarityThreshold = options?.similarityThreshold ?? 0.8;
	if (!(similarityThreshold >= 0 && similarityThreshold <= 1)) {
		throw new RangeError(
			`resolvePageClusterKeys: similarityThreshold must be between 0 and 1, got ${similarityThreshold}`,
		);
	}

	// Always computed: landmark fields are needed by Stage B's shell
	// corroboration regardless of `excludeLandmarks`, and `remainderHtml` is
	// needed whenever `excludeLandmarks` is true.
	const landmarks: readonly ExtractLandmarksResult[] = pages.map((page) =>
		extractLandmarks(page.html),
	);

	// Corpus-level chrome discovery
	const localLandmarkTokensByPage = computeLocalLandmarkTokens(landmarks, options);

	const contentBlockAttribute = options?.contentBlockAttribute;
	const preparedHtml = pages.map((page, index) => {
		const landmarksExcised = excludeLandmarks
			? landmarks[index]!.remainderHtml
			: page.html;
		return contentBlockAttribute === undefined
			? landmarksExcised
			: removeContentBlocks(landmarksExcised, { blockAttribute: contentBlockAttribute })
					.remainderHtml;
	});

	const restrictStylesheetsToFirstParty =
		options?.restrictStylesheetsToFirstParty ?? true;
	const blockingPages = restrictStylesheetsToFirstParty
		? filterFirstPartyStylesheetHrefs(pages)
		: pages;

	const blockKeys = resolveBlockKeys(blockingPages, options);
	const indicesByBlockKey = groupIndicesByBlockKey(blockKeys);

	// Validated here, eagerly, because it's otherwise only reached from
	// inside the per-block loop below — which never runs at all for an empty
	// `pages` (no blocks), silently skipping a bad option instead of failing
	// fast the way a direct `detectContentDepthCap` call always does.
	validateDetectContentDepthCapOptions(options);

	const finalKeys: string[] = Array.from({ length: pages.length });
	const crossBlockUnits: CrossBlockUnit[] = [];

	for (const [blockKey, indices] of indicesByBlockKey) {
		const result = stageAPerBlock(
			{
				blockKey,
				memberIndices: indices,
				preparedHtml: indices.map((i) => preparedHtml[i]!),
				landmarks: indices.map((i) => landmarks[i]!),
				localLandmarkTokensByPage: indices.map((i) => localLandmarkTokensByPage[i]!),
			},
			options,
		);
		for (const [pageIndex, key] of result.pageKeys) {
			finalKeys[pageIndex] = key;
		}
		crossBlockUnits.push(...result.crossBlockUnits);
	}

	// Stage B: cross-block merge — always runs regardless of options
	const stageBResult = mergeCrossBlockClusters(crossBlockUnits, options);
	for (let i = 0; i < finalKeys.length; i++) {
		const currentKey = finalKeys[i]!;
		const rootKey = stageBResult.get(currentKey);
		if (rootKey !== undefined && rootKey !== currentKey) {
			finalKeys[i] = rootKey;
		}
	}
	return finalKeys;
}

/**
 * Async twin of {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeysInMemory}
 * that emits `pass1-block-complete` (per block) and `stage-b-start`
 * `ProgressEvent`s and yields control back to the event loop between
 * blocks with `setImmediate`, so the async factory-based
 * `resolvePageClusterKeys` can expose live progress on small corpora
 * (`≤ CORPUS_INLINE_THRESHOLD`) without blocking the caller's UI thread.
 *
 * Semantic equivalence with `resolvePageClusterKeysInMemory` is preserved
 * exactly: same corpus-wide chrome discovery, same per-block Stage A, same
 * un-capped Stage B across the entire crossBlockUnits array. `finalKeys`
 * returned here must be byte-for-byte identical to what the sync path
 * would have produced for the same `pages` input — spec-enforced by
 * `resolve-page-cluster-keys-streaming.spec.ts`.
 *
 * The sync `resolvePageClusterKeysInMemory` is deliberately left in place
 * as its own implementation rather than being folded into a shared helper.
 * The intentional duplication guarantees that library callers who pass no
 * `onProgress` incur zero behavioral difference from the pre-refactor code
 * (see the `onProgress === undefined` short-circuit in
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}).
 * @param pages
 * @param onProgress
 * @param options
 */
async function resolveSmallCorpusWithProgress(
	pages: readonly PageClusterSignals[],
	onProgress: (event: ProgressEvent) => void,
	options?: ResolvePageClusterKeysOptions,
): Promise<string[]> {
	const excludeLandmarks = options?.excludeLandmarks ?? true;

	const similarityThreshold = options?.similarityThreshold ?? 0.8;
	if (!(similarityThreshold >= 0 && similarityThreshold <= 1)) {
		throw new RangeError(
			`resolvePageClusterKeys: similarityThreshold must be between 0 and 1, got ${similarityThreshold}`,
		);
	}

	const landmarks: readonly ExtractLandmarksResult[] = pages.map((page) =>
		extractLandmarks(page.html),
	);
	const localLandmarkTokensByPage = computeLocalLandmarkTokens(landmarks, options);

	const contentBlockAttribute = options?.contentBlockAttribute;
	const preparedHtml = pages.map((page, index) => {
		const landmarksExcised = excludeLandmarks
			? landmarks[index]!.remainderHtml
			: page.html;
		return contentBlockAttribute === undefined
			? landmarksExcised
			: removeContentBlocks(landmarksExcised, { blockAttribute: contentBlockAttribute })
					.remainderHtml;
	});

	const restrictStylesheetsToFirstParty =
		options?.restrictStylesheetsToFirstParty ?? true;
	const blockingPages = restrictStylesheetsToFirstParty
		? filterFirstPartyStylesheetHrefs(pages)
		: pages;

	const blockKeys = resolveBlockKeys(blockingPages, options);
	const indicesByBlockKey = groupIndicesByBlockKey(blockKeys);

	validateDetectContentDepthCapOptions(options);

	const finalKeys: string[] = Array.from({ length: pages.length });
	const crossBlockUnits: CrossBlockUnit[] = [];
	const totalBlocks = indicesByBlockKey.size;
	let blocksProcessed = 0;

	for (const [blockKey, indices] of indicesByBlockKey) {
		const result = stageAPerBlock(
			{
				blockKey,
				memberIndices: indices,
				preparedHtml: indices.map((i) => preparedHtml[i]!),
				landmarks: indices.map((i) => landmarks[i]!),
				localLandmarkTokensByPage: indices.map((i) => localLandmarkTokensByPage[i]!),
			},
			options,
		);
		for (const [pageIndex, key] of result.pageKeys) {
			finalKeys[pageIndex] = key;
		}
		crossBlockUnits.push(...result.crossBlockUnits);
		blocksProcessed++;
		onProgress({
			phase: 'pass1-block-complete',
			blockKey,
			blocksProcessed,
			totalBlocks,
		});
		// Yield to the event loop so Lanes' setTimeout frame can paint the
		// updated header before the next block starts.
		await new Promise<void>((resolve) => setImmediate(resolve));
	}

	onProgress({ phase: 'stage-b-start', unitCount: crossBlockUnits.length });

	const stageBResult = mergeCrossBlockClusters(crossBlockUnits, options);
	for (let i = 0; i < finalKeys.length; i++) {
		const currentKey = finalKeys[i]!;
		const rootKey = stageBResult.get(currentKey);
		if (rootKey !== undefined && rootKey !== currentKey) {
			finalKeys[i] = rootKey;
		}
	}
	return finalKeys;
}

/**
 * Factory function returning an iterator over pages. Called once per streaming
 * pass — the driver may invoke it multiple times to re-read the same corpus
 * (once HTML-free for blocking, once again per block for HTML processing).
 * Callers with a materialized array can wrap it as
 * `() => pagesArray[Symbol.iterator]()`, or use
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeysFromArray}.
 *
 * ## Why a factory rather than an `AsyncIterable`
 *
 * An `AsyncIterable` returned once cannot be traversed a second time (the
 * iterator is spent after the first `for await`). The streaming driver must
 * read the corpus at least twice — once with HTML dropped to compute
 * blocking keys, and once again per block to process HTML. A factory
 * function lets the caller build a fresh iterator each pass (typically by
 * re-opening a JSONL file or re-issuing an archive query), so per-corpus
 * memory stays proportional to the largest single block rather than to the
 * full corpus.
 */
export type PageFactory = () =>
	Iterable<PageClusterSignals> | AsyncIterable<PageClusterSignals>;

/**
 * Streaming, memory-bounded version of `resolvePageClusterKeysInMemory`.
 *
 * ## Behavior gate
 *
 * - `pageCount ≤ CORPUS_INLINE_THRESHOLD` — reads the whole factory into an
 *   array, delegates to `resolvePageClusterKeysInMemory`. Same corpus-wide
 *   chrome discovery, same Stage B across every page. All previously
 *   validated corpora (302 / 1,416 / 8,936 / 89 pages) hit this path.
 * - `pageCount > CORPUS_INLINE_THRESHOLD` — streaming path: reads the
 *   factory twice (once for blocking signals, once for HTML processing),
 *   dispatches HTML per block, runs Stage A per block, accumulates
 *   cross-block units, then runs Stage B across all accumulated units. Peak
 *   memory ≈ largest single block, not the whole corpus.
 *
 * ## Semantic differences in streaming mode
 *
 * - **Chrome discovery is per-block, not corpus-wide.** In the in-memory
 *   path, {@link ./resolve-page-cluster-keys.js | computeLocalLandmarkTokens}
 *   runs on all pages at once. In streaming mode the entire corpus cannot
 *   be held at once, so chrome discovery runs per block. A landmark
 *   signature that is rare corpus-wide but common within one block will
 *   be treated as global chrome in streaming mode, whereas the in-memory
 *   mode would treat it as local. This trade-off is why the threshold
 *   above is set generously — every real corpus historically validated
 *   here stays on the in-memory path.
 * @param pages
 * @param options
 * @example
 * ```ts
 * // JSONL file source — factory can be re-invoked to re-open the file.
 * import { createReadStream } from 'node:fs';
 * import readline from 'node:readline';
 *
 * const keys = await resolvePageClusterKeys(() => {
 *   const lines = readline.createInterface({ input: createReadStream('pages.jsonl') });
 *   return (async function* () {
 *     for await (const line of lines) yield JSON.parse(line);
 *   })();
 * });
 * ```
 */
export async function resolvePageClusterKeys(
	pages: PageFactory,
	options?: ResolvePageClusterKeysOptions,
): Promise<string[]> {
	const onProgress = options?.onProgress;
	// Pass 0: HTML-free — collect blocking signals (paths, stylesheetHrefs,
	// host) into an array. This is the only per-page state we keep across
	// the whole corpus in streaming mode.
	const blockingSignals: {
		paths: readonly string[];
		stylesheetHrefs: readonly string[];
		host?: string;
	}[] = [];
	for await (const page of pages()) {
		if (onProgress && blockingSignals.length > 0 && blockingSignals.length % 1000 === 0) {
			onProgress({ phase: 'pass0-signals', pagesSeen: blockingSignals.length });
		}
		blockingSignals.push({
			paths: page.paths,
			stylesheetHrefs: page.stylesheetHrefs,
			host: page.host,
		});
	}

	if (blockingSignals.length === 0) return [];

	// Small corpus: read the whole factory again with HTML this time, then
	// delegate to the in-memory path. Preserves every corpus-wide semantic
	// (chrome, Stage B) for corpora within the threshold.
	if (blockingSignals.length <= CORPUS_INLINE_THRESHOLD) {
		const fullPages: PageClusterSignals[] = [];
		for await (const page of pages()) {
			fullPages.push({
				paths: page.paths,
				stylesheetHrefs: page.stylesheetHrefs,
				html: page.html,
				host: page.host,
			});
		}
		// Without an onProgress callback the caller does not need visibility
		// into per-block progress, so delegate to the untouched sync path —
		// keeping behavior byte-for-byte identical (and yield-overhead-free)
		// to how library-only consumers experienced this before the CLI
		// progress work landed.
		if (onProgress === undefined) {
			return resolvePageClusterKeysInMemory(fullPages, options);
		}
		return resolveSmallCorpusWithProgress(fullPages, onProgress, options);
	}

	// Large corpus: streaming path.
	const excludeLandmarks = options?.excludeLandmarks ?? true;
	const similarityThreshold = options?.similarityThreshold ?? 0.8;
	if (!(similarityThreshold >= 0 && similarityThreshold <= 1)) {
		throw new RangeError(
			`resolvePageClusterKeys: similarityThreshold must be between 0 and 1, got ${similarityThreshold}`,
		);
	}
	validateDetectContentDepthCapOptions(options);

	const restrictStylesheetsToFirstParty =
		options?.restrictStylesheetsToFirstParty ?? true;
	const blockingPagesForKeys = restrictStylesheetsToFirstParty
		? filterFirstPartyStylesheetHrefs(blockingSignals)
		: blockingSignals;
	const blockKeys = resolveBlockKeys(blockingPagesForKeys, options);
	const indicesByBlockKey = groupIndicesByBlockKey(blockKeys);

	const finalKeys: string[] = Array.from({ length: blockingSignals.length });
	const crossBlockUnits: CrossBlockUnit[] = [];
	const contentBlockAttribute = options?.contentBlockAttribute;

	/**
	 * Per-block bucket accumulates a reservoir sample of the block's pages
	 * (at most {@link BLOCK_SAMPLE_SIZE}). When the block is fully seen, the
	 * sample is passed through Stage A to produce this block's cluster
	 * representatives.
	 */
	type BlockBucket = {
		readonly blockKey: string;
		readonly targetSize: number;
		/** Reservoir-bounded arrays of the sample-selected pages, parallel. */
		reservoirIndices: number[];
		reservoirPreparedHtml: string[];
		reservoirLandmarks: ExtractLandmarksResult[];
		/** Total pages seen so far for this block (across the whole stream). */
		seenCount: number;
		/** Per-block PRNG state; seed derived from block key for determinism. */
		prng: () => number;
	};
	/**
	 * Post–Stage-A learned parameters for a block. Used during Pass 1b to
	 * assign non-sample pages of that block to the block's clusters.
	 */
	type BlockAssignment = {
		/** `capContentDepth`'s `maxDepth`, learned from the sample. */
		readonly maxMainDepth: number | undefined;
		/** Signatures that are local chrome per the sample-based auto-cut. */
		readonly localSignatures: ReadonlySet<string>;
		/** unitKey → the sample members' token sets that back that cluster. */
		readonly clustersByUnitKey: ReadonlyMap<string, readonly ReadonlySet<string>[]>;
	};
	/** Non-sample page indices that need Pass 1b Jaccard-based assignment. */
	const pendingAssignmentBlockKeyByIndex = new Map<number, string>();
	/** Block-level artifacts saved after Stage A runs on the sample. */
	const blockAssignments = new Map<string, BlockAssignment>();

	const buckets = new Map<string, BlockBucket>();
	for (const [blockKey, indices] of indicesByBlockKey) {
		buckets.set(blockKey, {
			blockKey,
			targetSize: indices.length,
			reservoirIndices: [],
			reservoirPreparedHtml: [],
			reservoirLandmarks: [],
			seenCount: 0,
			prng: makeSeededPrng(blockKey),
		});
	}

	/**
	 * Runs Stage A on the block's reservoir sample, records sample-member
	 * cluster keys into `finalKeys`, saves per-cluster member token sets so
	 * Pass 1b can Jaccard-assign non-sample pages, and appends the produced
	 * `CrossBlockUnit`s to the Stage-B input.
	 * @param bucket
	 */
	function flushBlock(bucket: BlockBucket): void {
		const { localSignatures, localTokensByPage } = computeLocalChromeArtifacts(
			bucket.reservoirLandmarks,
			options,
		);
		const result = stageAPerBlock(
			{
				blockKey: bucket.blockKey,
				memberIndices: bucket.reservoirIndices,
				preparedHtml: bucket.reservoirPreparedHtml,
				landmarks: bucket.reservoirLandmarks,
				localLandmarkTokensByPage: localTokensByPage,
			},
			// No capMembers — the reservoir already bounds `sampleSize`.
			options,
		);
		for (const [idx, key] of result.pageKeys) {
			finalKeys[idx] = key;
		}
		crossBlockUnits.push(...result.crossBlockUnits);

		if (bucket.seenCount > bucket.reservoirIndices.length) {
			// Save assignment artifacts for Pass 1b.
			const maxMainDepth =
				bucket.reservoirPreparedHtml.length > 1
					? detectContentDepthCap(bucket.reservoirPreparedHtml, options)
					: undefined;
			const clustersByUnitKey = new Map<string, ReadonlySet<string>[]>();
			for (const unit of result.crossBlockUnits) {
				clustersByUnitKey.set(unit.key, [...unit.memberTokenSets]);
			}
			blockAssignments.set(bucket.blockKey, {
				maxMainDepth,
				localSignatures,
				clustersByUnitKey,
			});
		}

		// Encourage V8 to reclaim the reservoir's transient allocations.
		const maybeGc = (globalThis as { gc?: () => void }).gc;
		if (maybeGc !== undefined) maybeGc();
	}

	// Pass 1: stream HTML pages, reservoir-sample each block, run Stage A
	// on the sample the moment the block is fully seen.
	let pageIndex = 0;
	for await (const page of pages()) {
		const blockKey = blockKeys[pageIndex]!;
		const bucket = buckets.get(blockKey);
		if (bucket === undefined) {
			throw new Error(
				`resolvePageClusterKeys: block "${blockKey}" is missing from the bucket registry`,
			);
		}
		// Reservoir sampling (Algorithm R): keep the first BLOCK_SAMPLE_SIZE
		// pages, then for each subsequent one replace a random reservoir slot
		// with decreasing probability.
		if (bucket.reservoirIndices.length < BLOCK_SAMPLE_SIZE) {
			const landmarkResult = extractLandmarks(page.html);
			const landmarksExcised = excludeLandmarks
				? landmarkResult.remainderHtml
				: page.html;
			const prepared =
				contentBlockAttribute === undefined
					? landmarksExcised
					: removeContentBlocks(landmarksExcised, {
							blockAttribute: contentBlockAttribute,
						}).remainderHtml;
			const strippedLandmark = { ...landmarkResult, remainderHtml: '' };
			bucket.reservoirIndices.push(pageIndex);
			bucket.reservoirPreparedHtml.push(prepared);
			bucket.reservoirLandmarks.push(strippedLandmark);
		} else {
			const j = Math.floor(bucket.prng() * (bucket.seenCount + 1));
			if (j < BLOCK_SAMPLE_SIZE) {
				const landmarkResult = extractLandmarks(page.html);
				const landmarksExcised = excludeLandmarks
					? landmarkResult.remainderHtml
					: page.html;
				const prepared =
					contentBlockAttribute === undefined
						? landmarksExcised
						: removeContentBlocks(landmarksExcised, {
								blockAttribute: contentBlockAttribute,
							}).remainderHtml;
				const strippedLandmark = { ...landmarkResult, remainderHtml: '' };
				const evicted = bucket.reservoirIndices[j]!;
				pendingAssignmentBlockKeyByIndex.set(evicted, bucket.blockKey);
				bucket.reservoirIndices[j] = pageIndex;
				bucket.reservoirPreparedHtml[j] = prepared;
				bucket.reservoirLandmarks[j] = strippedLandmark;
			} else {
				pendingAssignmentBlockKeyByIndex.set(pageIndex, bucket.blockKey);
			}
		}
		bucket.seenCount++;

		if (bucket.seenCount === bucket.targetSize) {
			flushBlock(bucket);
			buckets.delete(bucket.blockKey);
			if (onProgress) {
				onProgress({
					phase: 'pass1-block-complete',
					blockKey: bucket.blockKey,
					blocksProcessed: indicesByBlockKey.size - buckets.size,
					totalBlocks: indicesByBlockKey.size,
				});
			}
		}
		pageIndex++;
	}

	if (pageIndex !== blockingSignals.length) {
		throw new Error(
			`resolvePageClusterKeys: streaming input yielded ${pageIndex} pages but Pass 0 saw ${blockingSignals.length} — factory must produce the same pages in the same order on repeated invocations`,
		);
	}
	if (buckets.size > 0) {
		throw new Error(
			`resolvePageClusterKeys: ${buckets.size} block(s) never reached their target size — this should not happen if the factory produced identical pages across the two passes`,
		);
	}

	// Pass 1b: for every non-sample page (evicted from a block's reservoir
	// or never selected), re-stream its HTML and Jaccard-assign it to the
	// nearest sample-derived cluster in its block. Nothing is added to
	// crossBlockUnits here — the assignment writes directly into finalKeys.
	if (pendingAssignmentBlockKeyByIndex.size > 0) {
		const totalToAssign = pendingAssignmentBlockKeyByIndex.size;
		let assignedCount = 0;
		let assignPageIndex = 0;
		for await (const page of pages()) {
			const targetBlockKey = pendingAssignmentBlockKeyByIndex.get(assignPageIndex);
			if (targetBlockKey !== undefined) {
				const assignment = blockAssignments.get(targetBlockKey);
				if (assignment !== undefined) {
					finalKeys[assignPageIndex] = assignPageToNearestCluster(
						page.html,
						assignment,
						excludeLandmarks,
						contentBlockAttribute,
						options,
						targetBlockKey,
					);
				}
				assignedCount++;
				if (onProgress && assignedCount % 1000 === 0) {
					onProgress({
						phase: 'pass1b-assign',
						pagesAssigned: assignedCount,
						pagesToAssign: totalToAssign,
					});
				}
			}
			assignPageIndex++;
		}
	}

	// Stage B: cross-block merge over the accumulated (sample-based) units.
	// Each unit already has at most BLOCK_SAMPLE_SIZE members from the
	// reservoir sampling above, so no additional cap is needed here — the
	// per-merge cost stays bounded across rounds.
	if (onProgress) {
		onProgress({ phase: 'stage-b-start', unitCount: crossBlockUnits.length });
	}
	const stageBResult = mergeCrossBlockClusters(crossBlockUnits, {
		...options,
		capMembers: BLOCK_SAMPLE_SIZE,
	});
	for (let i = 0; i < finalKeys.length; i++) {
		const currentKey = finalKeys[i]!;
		const rootKey = stageBResult.get(currentKey);
		if (rootKey !== undefined && rootKey !== currentKey) {
			finalKeys[i] = rootKey;
		}
	}
	return finalKeys;
}

/**
 * Convenience wrapper that runs {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}
 * on a materialized array. Preserves the pre-refactor sync API for callers
 * that already have all pages in memory, while flowing through the same
 * async driver so behavior stays consistent across the two entry points.
 * @param pages
 * @param options
 * @example
 * ```ts
 * const keys = await resolvePageClusterKeysFromArray([
 *   { paths: ['news', '1'], stylesheetHrefs: [], html: '<body><article>one</article></body>' },
 *   { paths: ['news', '2'], stylesheetHrefs: [], html: '<body><article>two</article></body>' },
 *   { paths: ['about'], stylesheetHrefs: [], html: '<body><section>about</section></body>' },
 * ]);
 * ```
 */
export function resolvePageClusterKeysFromArray(
	pages: readonly PageClusterSignals[],
	options?: ResolvePageClusterKeysOptions,
): Promise<string[]> {
	return resolvePageClusterKeys(() => pages, options);
}
