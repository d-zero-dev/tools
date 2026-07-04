import type { LandmarkType } from './extract-landmarks.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { extractLandmarks } from './extract-landmarks.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';
import { tokenize } from './tokenize.js';

/**
 * @see resolveLandmarkVariantKeys
 */
export type ResolveLandmarkVariantKeysOptions = TokenizeOptions &
	ResolveStructuralClusterKeysOptions;

/**
 * Classifies which *variant* of a single landmark type (e.g. "which header
 * design") each page has, independently of
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}'s overall
 * per-page template key. This is metadata to attach to a page ("does it have
 * header variant X?"), not a replacement for template clustering — callers
 * that want both call this once per `landmarkType` alongside
 * `resolvePageClusterKeys` and combine the results themselves; this function
 * does not know about, or merge with, the other one's output.
 *
 * Each call re-runs {@link ./extract-landmarks.js | extractLandmarks} over
 * the entire `htmlList`, keeping only the one field matching `landmarkType`
 * and discarding the other three it also computed. Calling this once per
 * `landmarkType` (as the paragraph above suggests, for a caller that wants
 * more than one) therefore re-parses every page once per type requested. A
 * caller for whom that cost is material should call `extractLandmarks`
 * itself once per page, read all four fields off the single result, and feed
 * each field's token sets to
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * directly (with the same empty-set sentinel for a missing field) instead of
 * calling this function multiple times.
 *
 * A page with no match for `landmarkType` (per
 * {@link ./extract-landmarks.js | extractLandmarks}) compares as an empty
 * token set. `jaccardSimilarity`'s documented treatment of two empty sets as
 * similarity `1` (see its JSDoc) means every landmark-less page lands in the
 * same "has no such landmark" group with no extra branching needed here, and
 * unambiguously in a different group from every page that does have one
 * (`jaccardSimilarity(∅, nonEmpty)` is always `0`). A landmark that exists
 * but is empty (e.g. `<header></header>`) never collides with this sentinel:
 * `tokenize` still emits at least the element's own segment for it.
 *
 * Does not block by URL path or stylesheet first (unlike
 * `resolvePageClusterKeys`): the same header design is normally reused
 * across a site's independent URL sections, so blocking on those signals
 * would work against this function's purpose. `resolveStructuralClusterKeys`
 * is therefore given the full `htmlList` as one pool, which means this
 * function inherits its O(n²) cost with no blocking to shrink `n` first —
 * intended for batches of up to a few thousand pages (validated against an
 * 800-page real sample), not for handing it an entire unblocked crawl.
 * @param htmlList
 * @param landmarkType
 * @param options
 * @example
 * ```ts
 * resolveLandmarkVariantKeys(
 * 	[
 * 		'<body><header><nav>A</nav></header></body>',
 * 		'<body><header><nav>A</nav></header></body>',
 * 		'<body><header><a>B</a></header></body>',
 * 	],
 * 	'header',
 * );
 * // pages 0 and 1 (structurally identical header) share a key; page 2 (a
 * // different header structure) gets its own — text content alone (e.g.
 * // the "A" vs "B" text) would not, since tokenize() discards visible text.
 * ```
 */
export function resolveLandmarkVariantKeys(
	htmlList: readonly string[],
	landmarkType: LandmarkType,
	options?: ResolveLandmarkVariantKeysOptions,
): string[] {
	const tokenSets = htmlList.map((html) => {
		const region = extractLandmarks(html)[landmarkType];
		if (region === undefined) {
			return new Set<string>();
		}
		return new Set(tokenize(`<body>${region}</body>`, options).tokens);
	});

	return resolveStructuralClusterKeys(tokenSets, options);
}
