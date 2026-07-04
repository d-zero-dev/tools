import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { extractLandmarks } from './extract-landmarks.js';
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
	const contentTokenSets = pages.map((page) => {
		const html = excludeLandmarks ? extractLandmarks(page.html).remainderHtml : page.html;
		return new Set(tokenize(html, options).tokens);
	});

	const blockKeys = resolveBlockingGroupKeys(pages, options);

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
