import type { ExtractLandmarksResult } from './extract-landmarks.js';
import type { CrossBlockUnit } from './merge-cross-block-clusters.js';
import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
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
import {
	detectContentDepthCap,
	validateDetectContentDepthCapOptions,
} from './detect-content-depth-cap.js';
import { extractLandmarks } from './extract-landmarks.js';
import { filterFirstPartyStylesheetHrefs } from './filter-first-party-stylesheet-hrefs.js';
import { mergeCrossBlockClusters } from './merge-cross-block-clusters.js';
import {
	mergeLandmarkAffinedClusters,
	validateMergeLandmarkAffinedClustersOptions,
} from './merge-landmark-affined-clusters.js';
import { reassignOrphanBlockKeys } from './reassign-orphan-block-keys.js';
import { removeContentBlocks } from './remove-content-blocks.js';
import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';
import { tokenize } from './tokenize.js';

/**
 * Reads `values[index]`, throwing instead of returning `undefined`. Every
 * call site here indexes with a position this function generated itself
 * (an entry from `Map#entries()`/`Array#entries()` over an array it just
 * built), so the thrown branch is unreachable in practice; it exists to
 * satisfy `noUncheckedIndexedAccess` without a non-null assertion. Not
 * imported from `resolve-structural-cluster-keys.ts`'s own copy: that file's
 * `export`s are its intended public API surface, and this ~7-line generic
 * helper isn't worth carving an exception into that boundary for (same
 * rationale as `readDpValue` in `array-edit-distance.ts` being its own
 * independent copy rather than a shared import).
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('resolvePageClusterKeys: index out of bounds');
	}
	return value;
}

/**
 * Per-page input to {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}:
 * the blocking signals {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * needs, plus the page's raw HTML. Raw HTML (rather than a pre-tokenized
 * `Set`, as earlier versions of this type required) because
 * `resolvePageClusterKeys` now needs to decide *how* to tokenize each page
 * (see `excludeLandmarks` below) — a decision a caller handed a bare
 * `Set<string>` could no longer make correctly on its own.
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
	 * instead of inferring a batch-wide dominant host. Optional: omit if the
	 * caller doesn't have each page's URL on hand, at the cost of that
	 * function's dominant-host fallback and its known limitations (see its
	 * own JSDoc) — most crawlers already have this since they fetched the
	 * page from that URL, so providing it is the expected default.
	 */
	host?: string;
};

/**
 * @see resolvePageClusterKeys
 */
export type ResolvePageClusterKeysOptions = TokenizeOptions &
	ResolveBlockingGroupKeysOptions &
	ResolveStructuralClusterKeysOptions & {
		/**
		 * Tokenize each page's `<header>`/`<footer>`/`<nav>`/`<aside>`-excised
		 * remainder ({@link ./extract-landmarks.js | extractLandmarks}'s
		 * `remainderHtml`) instead of its raw HTML, so shared site chrome never
		 * reaches the structural-similarity comparison. Defaults to `true`.
		 * Set to `false` to fall back to tokenizing the untouched page (the
		 * pre-landmark-extraction behavior) — this is a large behavioral
		 * change not yet validated across many sites beyond the two real
		 * corpora checked so far, so the escape hatch is kept available.
		 *
		 * Leaving this `true` means every page's HTML is parsed twice (once by
		 * `extractLandmarks`, once by `tokenize` on its `remainderHtml`)
		 * instead of once. Measured on a real crawl corpus (8,936 pages),
		 * this is still net faster overall than the single-parse `false`
		 * path (17,557ms vs 25,997ms end-to-end): `remainderHtml` is
		 * substantially shorter than the original page once landmarks are
		 * excised, and the resulting smaller `tokenize` pass costs less than
		 * the extra `extractLandmarks` pass adds.
		 */
		excludeLandmarks?: boolean;
		/**
		 * Apply {@link ./reassign-orphan-block-keys.js | reassignOrphanBlockKeys}
		 * to the blocking keys before clustering, so a page with no recorded
		 * stylesheets ("orphan" — often a crawl-completeness gap, not evidence
		 * the page is actually template-less) can rejoin a same-URL-section
		 * `css:` block instead of being stranded on its weaker `path:` fallback.
		 * Defaults to `true`. Set to `false` to fall back to the raw
		 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
		 * output — kept available both because this is not yet broadly-
		 * validated beyond the two real crawls checked so far, and because it
		 * has a known trade-off documented on
		 * {@link ./reassign-orphan-block-keys.js | reassignOrphanBlockKeys}
		 * itself: pooling pages for comparison can change unrelated pages'
		 * cluster outcomes too, not just the orphan's.
		 */
		reassignOrphans?: boolean;
		/**
		 * Apply {@link ./remove-content-blocks.js | removeContentBlocks} to each
		 * page's landmark-excised remainder before tokenizing, so a freeform
		 * block-editor content area's page-to-page variation (which specific
		 * mix of blocks an author used) never reaches the structural-similarity
		 * comparison. No default — unlike `excludeLandmarks`/`reassignOrphans`,
		 * this needs the caller's own block-editor attribute name (see
		 * `removeContentBlocks`'s `blockAttribute` option), which this package
		 * cannot guess. Omit to skip this step entirely.
		 */
		contentBlockAttribute?: string;
		/**
		 * Apply {@link ./filter-first-party-stylesheet-hrefs.js |
		 * filterFirstPartyStylesheetHrefs} to `pages` before computing blocking
		 * keys, so a page's incidental third-party embeds (e.g. a video
		 * player's own stylesheet, extra web-font requests pulled in by a
		 * widget) never get mistaken for a template-identifying signal by
		 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}.
		 * Defaults to `true`. Set to `false` to block on every page's full,
		 * unfiltered `stylesheetHrefs` — kept available for the same reason
		 * `excludeLandmarks`'s escape hatch is: a real but not yet broadly-
		 * validated behavioral change (confirmed so far on one real crawl).
		 *
		 * Inherits `filterFirstPartyStylesheetHrefs`'s "roughly homogeneous
		 * batch" precondition (see that function's own JSDoc): `pages` should
		 * be one site or one section, the same expectation
		 * `resolveBlockingGroupKeys` already places on its own input.
		 *
		 * Provide each page's `host` (see `PageClusterSignals`) so this filter
		 * can compare directly instead of inferring a batch-wide dominant
		 * host — the inferred fallback can pick the wrong host on a tie (e.g.
		 * a page loading its own first-party stylesheet plus the same
		 * sitewide webfont request as every other page, tying "referenced by
		 * 100% of pages" between the real first party and that third party).
		 */
		restrictStylesheetsToFirstParty?: boolean;
		/**
		 * Apply {@link ./detect-content-depth-cap.js | detectContentDepthCap}
		 * separately *within each block* (after `excludeLandmarks`/
		 * `contentBlockAttribute`, after blocking, before that block's own
		 * tokenizing) to find how many levels of nesting inside
		 * `<main>`/`role="main"` to keep, then
		 * {@link ./cap-content-depth.js | capContentDepth} each of that
		 * block's pages at that depth — a `contentBlockAttribute`-style fix
		 * for freeform-content noise that needs no site-specific attribute
		 * name, since `<main>` is an HTML5/ARIA standard. Defaults to `true`
		 * (changed from the previous default of `false` — callers that relied
		 * on the old opt-in behavior must now pass `autoCapMainDepth: false`
		 * explicitly). Validated on two real crawl corpora (302 pages and
		 * 8,936 pages) as correct for most sites. The self-tuning cross-block
		 * Stage B that runs after Stage A assumes this cap is enabled; running
		 * without it (`false`) still works but produces uncapped tokens that
		 * Stage B has not been validated against.
		 *
		 * Per-block rather than once across the whole corpus: different
		 * blocks (different templates/sections) can have genuinely different
		 * "skeleton depths." Confirmed on real crawl data: an 814-page block
		 * whose own knee sits at depth 2 stayed at 189 clusters (barely moved
		 * from 224 uncapped) when capped at depth 3 — the knee derived from
		 * the *whole* 8,936-page corpus, dominated by two much larger blocks
		 * whose own knee is 3. Re-deriving the knee for that block alone
		 * brings it down to 46. A block too small for its knee-detection
		 * sweep to find a reliable jump just falls through to
		 * `detectContentDepthCap`'s own no-knee fallback (the largest
		 * candidate depth, effectively "don't cap") — the same safe default
		 * it already has for any input, now reached per-block instead of
		 * corpus-wide. Skipped entirely (no cap) for a block of exactly 1
		 * page — nothing to compare it against, so a knee sweep there could
		 * only ever confirm what's already true.
		 *
		 * Trade-off of going per-block: a corpus-wide sweep's cluster-count
		 * ratios are diluted by thousands of ordinary pages, so one
		 * incidental outlier (e.g. a single page with an extra wrapper `div`
		 * from a stray widget) barely moves them. A small block's sweep has
		 * no such dilution — a similar outlier among only a handful of pages
		 * can itself clear `minKneeRatio` and produce a too-shallow cap for
		 * that block. Not yet observed on either real corpus checked so far
		 * (both corpora's small blocks happened to be uniform enough that
		 * this didn't come up), so no size-based guard is added speculatively;
		 * revisit if real data surfaces it.
		 *
		 * Composes with `contentBlockAttribute` rather than replacing it: both
		 * can be set at once — `removeContentBlocks` runs first, then
		 * `capContentDepth` on what's left — for a site whose CMS marks *some*
		 * blocks with a known attribute but still has other, unmarked
		 * freeform depth the attribute alone doesn't catch.
		 *
		 * Confirmed on real crawl data this can outperform
		 * `contentBlockAttribute` on its own, not just stand in for it when the
		 * attribute is unknown: on a 302-page corpus, `autoCapMainDepth` alone
		 * produced 20 final clusters versus 27 for
		 * `contentBlockAttribute: 'data-bgb'` together with
		 * `restrictStylesheetsToFirstParty` — the site's known CMS attribute
		 * doesn't mark every source of freeform depth, but the `<main>`
		 * boundary catches all of it uniformly. See `detectContentDepthCap`'s
		 * JSDoc for the real cost/accuracy numbers this per-block sweep
		 * measures on the same two corpora.
		 */
		autoCapMainDepth?: boolean;
		/**
		 * Re-key two or more otherwise-distinct clusters onto one shared key
		 * when every landmark type present on their pages is both identical
		 * and rare corpus-wide — see
		 * {@link ./merge-landmark-affined-clusters.js | mergeLandmarkAffinedClusters}'s
		 * JSDoc for the exact rule, the withdrawn earlier prototype this
		 * reimplements, and why "rare" (not merely "identical") is required.
		 * Defaults to `false`.
		 *
		 * Kept `false` by default: unlike `autoCapMainDepth`/
		 * `restrictStylesheetsToFirstParty`, this has not been run against
		 * real crawl data at all as of this change — only synthetic-fixture
		 * unit/regression tests. See `mergeLandmarkAffinedClusters`'s JSDoc
		 * for its cost profile before enabling this on a large corpus.
		 */
		mergeRareLandmarkClusters?: boolean;
		/** Forwarded to {@link ./merge-landmark-affined-clusters.js | mergeLandmarkAffinedClusters} as-is. */
		landmarkRarityThreshold?: number;
		/** Forwarded to {@link ./merge-landmark-affined-clusters.js | mergeLandmarkAffinedClusters} as-is. */
		landmarkGateSimilarityThreshold?: number;
	};

/**
 * Connects the two stages this package otherwise leaves for the caller to
 * wire together: {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * (coarse blocking by URL path or stylesheet set) and structural clustering
 * within each block. Returns one final key per page, in the same order as
 * `pages`, unique across the whole input — not just within a block.
 *
 * **Stage A (per block):** Runs the complete-linkage dendrogram
 * ({@link ./complete-linkage-dendrogram.js | completeLinkageDendrogram})
 * and selects a threshold automatically via
 * {@link ./auto-cut-threshold.js | autoCutThreshold} (largest merge-height
 * gap, clamped to `similarityThreshold` so the default is never tightened,
 * only loosened). **`similarityThreshold` is an upper bound here, not a
 * per-pair hard floor** — the auto-cut can select a lower value when a
 * natural cluster boundary exists below `similarityThreshold`. To enforce a
 * strict minimum Jaccard per page-pair, use
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * directly (it skips auto-cut). For blocks large enough for frequency-based
 * comparison (`>= MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT`), each cluster's
 * token union (with anonymous `div` wrappers collapsed via
 * {@link ./collapse-anonymous-divs.js | collapseAnonymousDivs}) passes
 * through
 * {@link ./assign-contained-clusters.js | assignContainedClusters}
 * (containment ≥ 0.9) to absorb clusters caused by conditional rendering
 * (missing optional section, paginator absent). See
 * `assignContainedClusters`'s JSDoc for why this is directed assignment
 * rather than union-find.
 *
 * **Stage B (cross-block, always):** After all blocks are processed,
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}
 * iteratively merges units across block boundaries — breaking through the
 * URL-path and stylesheet-set walls that Stage A cannot cross. Uses quorum
 * cores (80% of member pages' corpus-distinctive tokens) with three merge
 * mechanisms: complete-linkage at the fixed threshold (0.8), containment,
 * and shape-Jaccard (class-name-stripped skeleton similarity ≥ 0.9 for
 * multi-page units only). When those find nothing, falls back to an L2
 * multiset-containment signature anchored at `<main>` with shell
 * (header+nav+footer) corroboration. Converges to a fixed point in ≤ 10
 * rounds (real crawl data: 2–5 rounds).
 *
 * Cluster keys are composed from the block key and the local per-block
 * label via `JSON.stringify` (rather than string concatenation) to avoid
 * collisions regardless of what either half contains. Stage B preserves
 * the root unit's existing key, so merged clusters receive a key from one
 * of their constituent blocks, not a newly invented one.
 *
 * `excludeLandmarks` and `similarityThreshold` interact: removing shared
 * chrome makes every remaining comparison stricter (there's no more
 * chrome-driven baseline similarity propping scores up), so a threshold
 * tuned against raw, chrome-included tokens can become too strict once
 * landmarks are excluded. Confirmed on real crawl data: a 4-page block where
 * 3 same-template pages merged at the default `similarityThreshold` (0.8)
 * using raw tokens split one of the 3 into its own singleton once landmarks
 * were excluded, and re-merged correctly at `similarityThreshold: 0.6` — re-
 * tune per site after switching this on, the same as `similarityThreshold`
 * itself already needs.
 *
 * `reassignOrphans` only ever pools a `path:`-fallback orphan alongside a
 * same-section `css:` block for comparison — it never forces a merge itself.
 * An orphan that turns out not to match anything in that pool (confirmed on
 * real crawl data) correctly surfaces as its own singleton.
 *
 * `restrictStylesheetsToFirstParty` runs before `reassignOrphans`: a page
 * whose only stylesheet reference was third-party becomes an orphan (no
 * first-party stylesheet left) *because of* the filtering, and is then
 * itself eligible for orphan reassignment — this is intentional, not an
 * ordering accident, since the underlying reason both options exist is the
 * same (a page's blocking key should reflect its template, not incidental
 * third-party embeds or missing crawl data).
 * @param pages
 * @param options
 * @example
 * ```ts
 * resolvePageClusterKeys([
 * 	{ paths: ['news', '1'], stylesheetHrefs: [], html: '<body><article>one</article></body>' },
 * 	{ paths: ['news', '2'], stylesheetHrefs: [], html: '<body><article>two</article></body>' },
 * 	{ paths: ['about'], stylesheetHrefs: [], html: '<body><section>about</section></body>' },
 * ]);
 * // pages 0 and 1 (same block, same structure) share a key; page 2 (different block) gets its own
 * ```
 */
export function resolvePageClusterKeys(
	pages: readonly PageClusterSignals[],
	options?: ResolvePageClusterKeysOptions,
): string[] {
	const excludeLandmarks = options?.excludeLandmarks ?? true;
	const mergeRareLandmarkClusters = options?.mergeRareLandmarkClusters ?? false;
	if (mergeRareLandmarkClusters) {
		// Eager, same rationale as autoCapMainDepth's own eager validation
		// below: this option's own validation is otherwise only reached from
		// mergeLandmarkAffinedClusters's call at the very end of this
		// function, which never runs at all for an empty `pages`.
		validateMergeLandmarkAffinedClustersOptions(options);
	}

	const similarityThreshold = options?.similarityThreshold ?? 0.8;
	if (!(similarityThreshold >= 0 && similarityThreshold <= 1)) {
		throw new RangeError(
			`resolvePageClusterKeys: similarityThreshold must be between 0 and 1, got ${similarityThreshold}`,
		);
	}

	// Always computed: landmark fields are needed by Stage B's shell
	// corroboration regardless of excludeLandmarks/mergeRareLandmarkClusters,
	// and remainderHtml is needed whenever excludeLandmarks is true.
	// extractLandmarks parses the whole page once; computing it upfront avoids
	// parsing the same page twice for the two options that each need it.
	const landmarks: readonly ExtractLandmarksResult[] = pages.map((page) =>
		extractLandmarks(page.html),
	);

	const contentBlockAttribute = options?.contentBlockAttribute;
	const preparedHtml = pages.map((page, index) => {
		const landmarksExcised = excludeLandmarks
			? requireIndex(landmarks, index).remainderHtml
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

	const reassignOrphans = options?.reassignOrphans ?? true;
	const rawBlockKeys = resolveBlockingGroupKeys(blockingPages, options);
	const blockKeys = reassignOrphans
		? reassignOrphanBlockKeys(blockingPages, rawBlockKeys, options?.pathDepth)
		: rawBlockKeys;

	const indicesByBlockKey = new Map<string, number[]>();
	for (const [index, blockKey] of blockKeys.entries()) {
		const indices = indicesByBlockKey.get(blockKey);
		if (indices) {
			indices.push(index);
		} else {
			indicesByBlockKey.set(blockKey, [index]);
		}
	}

	const autoCapMainDepth = options?.autoCapMainDepth ?? true;
	if (autoCapMainDepth) {
		// Validated here, eagerly, because it's otherwise only reached from
		// inside the per-block loop below — which never runs at all for an
		// empty `pages` (no blocks), silently skipping a bad option instead
		// of failing fast the way a direct `detectContentDepthCap` call
		// always does.
		validateDetectContentDepthCapOptions(options);
	}

	const finalKeys: string[] = Array.from({ length: pages.length });
	const crossBlockUnits: CrossBlockUnit[] = [];

	for (const [blockKey, indices] of indicesByBlockKey) {
		const blockPreparedHtml = indices.map((index) => requireIndex(preparedHtml, index));
		// A block of 1 can never produce more than one cluster regardless of
		// how it's tokenized — nothing to compare it against — so detecting a
		// knee and capping for it would only spend a full multi-depth sweep
		// (see detectContentDepthCap's own cost notes) to arrive back at the
		// same single-cluster result. Skipped rather than swept.
		const maxMainDepth =
			autoCapMainDepth && blockPreparedHtml.length > 1
				? detectContentDepthCap(blockPreparedHtml, options)
				: undefined;
		const blockTokenSets: ReadonlySet<string>[] = blockPreparedHtml.map((html) => {
			const capped =
				maxMainDepth === undefined
					? html
					: capContentDepth(html, { landmark: 'main', maxDepth: maxMainDepth })
							.remainderHtml;
			return new Set(tokenize(capped, options).tokens);
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
		// threshold as deriveComparisonSets): below that floor, comparison sets
		// equal raw token sets, and containment on full token sets causes chrome-
		// dominated pages (index page whose HTML includes every nav variant) to
		// spuriously absorb unrelated clusters.
		if (blockSize >= MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT) {
			const clusterTokens = new Map<number, Set<string>>();
			const clusterPageCount = new Map<number, number>();
			for (let i = 0; i < blockSize; i++) {
				const r = requireIndex(roots, i);
				let tokens = clusterTokens.get(r);
				if (!tokens) {
					tokens = new Set();
					clusterTokens.set(r, tokens);
				}
				for (const t of requireIndex(comparisonSets, i))
					tokens.add(collapseAnonymousDivs(t));
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

		for (const [position, pageIndex] of indices.entries()) {
			finalKeys[pageIndex] = JSON.stringify([
				blockKey,
				requireIndex(localLabels, position),
			]);
		}

		// Gather CrossBlockUnit entries for Stage B
		const unitKeyToPositions = new Map<string, number[]>();
		for (const [position, pageIndex] of indices.entries()) {
			const unitKey = finalKeys[pageIndex]!;
			let positions = unitKeyToPositions.get(unitKey);
			if (!positions) {
				positions = [];
				unitKeyToPositions.set(unitKey, positions);
			}
			positions.push(position);
		}
		for (const [unitKey, positions] of unitKeyToPositions) {
			crossBlockUnits.push({
				key: unitKey,
				memberTokenSets: positions.map((pos) => requireIndex(blockTokenSets, pos)),
				memberLandmarks: positions.map((pos) =>
					requireIndex(landmarks, requireIndex(indices, pos)),
				),
			});
		}
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

	if (!mergeRareLandmarkClusters) {
		return finalKeys;
	}
	// Deliberately not a reuse of blockTokenSets (this function's own
	// primary-clustering token sets): those follow excludeLandmarks (raw
	// HTML, landmarks included, when false) and the Stage A frequency
	// narrowing can further filter them for large blocks.
	// mergeLandmarkAffinedClusters's secondary content-similarity gate is
	// meant to be independent corroboration alongside the landmark match
	// already used to select these pages — if it reused landmark-inclusive
	// tokens, a bulky shared rare header's own tokens could inflate two
	// otherwise-unrelated pages' similarity past the gate, and if it reused
	// the frequency-narrowed set, the gate would silently test different
	// content than its own JSDoc describes. Always tokenizing each page's
	// landmark-excised remainderHtml here keeps the gate's evidence
	// independent of both.
	const mergeGateContentTokenSets = landmarks.map(
		(entry) => new Set(tokenize(entry.remainderHtml, options).tokens),
	);
	return mergeLandmarkAffinedClusters(
		finalKeys,
		landmarks,
		mergeGateContentTokenSets,
		options,
	);
}
