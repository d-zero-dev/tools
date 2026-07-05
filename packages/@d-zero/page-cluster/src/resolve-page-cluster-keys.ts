import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { capContentDepth } from './cap-content-depth.js';
import { detectContentDepthCap } from './detect-content-depth-cap.js';
import { extractLandmarks } from './extract-landmarks.js';
import { filterFirstPartyStylesheetHrefs } from './filter-first-party-stylesheet-hrefs.js';
import { reassignOrphanBlockKeys } from './reassign-orphan-block-keys.js';
import { removeContentBlocks } from './remove-content-blocks.js';
import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';
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
		 */
		restrictStylesheetsToFirstParty?: boolean;
		/**
		 * Apply {@link ./detect-content-depth-cap.js | detectContentDepthCap}
		 * once across all of `pages` (after `excludeLandmarks`/
		 * `contentBlockAttribute`, before tokenizing) to find how many levels
		 * of nesting inside `<main>`/`role="main"` to keep, then
		 * {@link ./cap-content-depth.js | capContentDepth} each page at that
		 * depth — a `contentBlockAttribute`-style fix for freeform-content
		 * noise that needs no site-specific attribute name, since `<main>` is
		 * an HTML5/ARIA standard. Defaults to `false`: unlike
		 * `contentBlockAttribute` (which does nothing unless a matching
		 * attribute is actually present), this discards real content whenever
		 * a page has a `<main>`/`role="main"` at all, so it's opt-in until
		 * validated on more than the two real corpora checked so far.
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
		 * boundary catches all of it uniformly. On a real 8,936-page whole-site
		 * corpus, it cut final cluster count from 1,972 to 283, at a real cost
		 * of ~5m50s versus ~16s without it (see
		 * `detectContentDepthCap`'s JSDoc for why: it reruns structural
		 * clustering once per candidate depth to find the cap).
		 */
		autoCapMainDepth?: boolean;
	};

/**
 * Connects the two stages this package otherwise leaves for the caller to
 * wire together: {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * (coarse blocking by URL path or stylesheet set) and
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * (exact structural clustering *within* one block). Returns one final key
 * per page, in the same order as `pages`, unique across the whole input —
 * not just within a block.
 *
 * `resolveStructuralClusterKeys` numbers its clusters `cluster:0`,
 * `cluster:1`, ... independently every time it's called, so two different
 * blocks' `cluster:0` are unrelated but identically named. Composing the
 * block key and the per-block cluster label via `JSON.stringify` (rather
 * than plain string concatenation, e.g. a `::` separator) rules out
 * collisions regardless of what either half happens to contain, without
 * depending on `resolveStructuralClusterKeys`'s label format never changing.
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
 * same-section `css:` block for `resolveStructuralClusterKeys` to compare —
 * it never forces a merge itself. An orphan that turns out not to match
 * anything in that pool (confirmed on real crawl data) correctly surfaces as
 * its own singleton, the same as it would have without this option.
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
	const contentBlockAttribute = options?.contentBlockAttribute;
	const preparedHtml = pages.map((page) => {
		const landmarksExcised = excludeLandmarks
			? extractLandmarks(page.html).remainderHtml
			: page.html;
		return contentBlockAttribute === undefined
			? landmarksExcised
			: removeContentBlocks(landmarksExcised, { blockAttribute: contentBlockAttribute })
					.remainderHtml;
	});

	const autoCapMainDepth = options?.autoCapMainDepth ?? false;
	const maxMainDepth = autoCapMainDepth
		? detectContentDepthCap(preparedHtml, options)
		: undefined;

	const contentTokenSets = preparedHtml.map((html) => {
		const capped =
			maxMainDepth === undefined
				? html
				: capContentDepth(html, { landmark: 'main', maxDepth: maxMainDepth })
						.remainderHtml;
		return new Set(tokenize(capped, options).tokens);
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

	const finalKeys: string[] = Array.from({ length: pages.length });
	for (const [blockKey, indices] of indicesByBlockKey) {
		const blockTokenSets = indices.map((index) => requireIndex(contentTokenSets, index));
		const localLabels = resolveStructuralClusterKeys(blockTokenSets, options);

		for (const [position, index] of indices.entries()) {
			finalKeys[index] = JSON.stringify([blockKey, requireIndex(localLabels, position)]);
		}
	}

	return finalKeys;
}
