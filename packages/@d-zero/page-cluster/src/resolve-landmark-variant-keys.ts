import type { LandmarkType } from './extract-landmarks.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { extractLandmarks } from './extract-landmarks.js';
import { computePerPageLandmarkInstances } from './per-page-landmark-signatures.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';

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
 * ## Per-page canonical instance selection
 *
 * A page can now have any number of landmark instances of the requested
 * type (see {@link ./extract-landmarks.js | extractLandmarks} for why the
 * old shallowest-wins rule was removed). For "which variant does this page
 * have", the canonical instance is the one whose token-set signature is
 * most common across the corpus, ties broken by document order. This picks
 * the site-wide chrome instance automatically — the shared site header
 * dominates the corpus histogram — while article-specific `<header>`s that
 * vary per page carry frequency 1 and are never selected. Choosing this way
 * is the data-driven analogue of the old shallowest-wins rule, without
 * fragmenting variant keys into singletons (a real regression risk of a
 * naive "union every instance's tokens" approach: 10 pages that each carry
 * both a site header and a per-article header would every one produce a
 * distinct union token set, collapsing every page into its own variant key).
 *
 * A page with no matching landmark compares as an empty token set.
 * `jaccardSimilarity`'s documented treatment of two empty sets as
 * similarity `1` (see its JSDoc) means every landmark-less page lands in
 * the same "has no such landmark" group with no extra branching needed
 * here, and unambiguously in a different group from every page that does
 * have one (`jaccardSimilarity(∅, nonEmpty)` is always `0`). A landmark
 * that exists but tokenizes to an empty set never collides with this
 * sentinel because `tokenize` skips it (see `computePerPageLandmarkInstances`).
 *
 * ## Cost
 *
 * Each call re-runs `extractLandmarks` over the entire `htmlList`, keeping
 * only the one field matching `landmarkType`. Calling this once per
 * `landmarkType` (as callers wanting more than one design signal do)
 * re-parses every page once per type requested. A caller for whom that cost
 * is material should call `extractLandmarks` itself once per page, read all
 * fields off the single result, and feed each field's canonical-instance
 * tokens to
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * directly instead.
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
 * // Header variants
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
 *
 * // Same idea works for the other landmark types:
 * resolveLandmarkVariantKeys(htmlList, 'nav');
 * resolveLandmarkVariantKeys(htmlList, 'footer');
 * resolveLandmarkVariantKeys(htmlList, 'aside');
 * ```
 */
export function resolveLandmarkVariantKeys(
	htmlList: readonly string[],
	landmarkType: LandmarkType,
	options?: ResolveLandmarkVariantKeysOptions,
): string[] {
	const landmarks = htmlList.map((html) => extractLandmarks(html));
	const perPageInstances = computePerPageLandmarkInstances(landmarks, options);

	// Corpus-wide instance-signature histogram (restricted to the requested
	// landmark type). Used to pick each page's canonical instance —
	// see this function's JSDoc for why "most common" beats "union of all".
	const corpusInstanceCount = new Map<string, number>();
	for (const instances of perPageInstances) {
		const seenTypedSignatures = new Set<string>();
		for (const inst of instances) {
			if (inst.type !== landmarkType) continue;
			if (seenTypedSignatures.has(inst.signature)) continue;
			seenTypedSignatures.add(inst.signature);
			corpusInstanceCount.set(
				inst.signature,
				(corpusInstanceCount.get(inst.signature) ?? 0) + 1,
			);
		}
	}

	const tokenSets = perPageInstances.map((instances) => {
		let best: { tokens: ReadonlySet<string>; count: number } | undefined;
		for (const inst of instances) {
			if (inst.type !== landmarkType) continue;
			const count = corpusInstanceCount.get(inst.signature) ?? 0;
			if (best === undefined || count > best.count) {
				best = { tokens: inst.tokens, count };
			}
		}
		return best?.tokens ?? new Set<string>();
	});

	return resolveStructuralClusterKeys(tokenSets, options);
}
