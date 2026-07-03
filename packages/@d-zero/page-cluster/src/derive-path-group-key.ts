/**
 * Derives a coarse grouping key from a page's URL path segments (e.g. the
 * `paths` field of `@d-zero/shared/parse-url`'s `ExURL`), keeping only the
 * leading `depth` segments. This is a *blocking key* in the record-linkage
 * sense: a cheap, coarse partition applied before any expensive structural
 * comparison (`jaccardSimilarity`/`arrayEditDistance` on `tokenize()`
 * output), not a similarity score by itself. Real-data validation on a large
 * multi-section site found that a single site-wide document-frequency
 * computation ({@link ./compute-document-frequency.js | computeDocumentFrequency})
 * fails when the site is actually a federation of independently-templated
 * sub-sections; splitting pages by their top-level URL segment first and
 * computing frequency per group recovered a working split. This function
 * produces that split key.
 *
 * Deliberately returns only this one signal rather than merging it with
 * other blocking signals (e.g. a stylesheet-based key) into a single
 * composite key: literature on entity-resolution blocking (e.g. Michelson &
 * Knoblock's DNF blocking scheme) finds that combining independent blocking
 * predicates with AND into one key is inferior to keeping them independent
 * and combining candidate pairs with OR — that combination decision belongs
 * to the caller that actually groups pages, not to this function.
 *
 * Empty segments anywhere in `paths` are dropped before slicing, so the
 * trailing `''` that `ExURL.paths` produces for a directory-style URL (one
 * ending in `/`) doesn't fragment a section's key from the same section's
 * non-trailing-slash URLs.
 * @param paths
 * @param depth
 * @example
 * ```ts
 * derivePathGroupKey(['dept-a', 'news', '123']);
 * // 'dept-a'
 * derivePathGroupKey(['dept-a', 'news', '123'], 2);
 * // 'dept-a/news'
 * derivePathGroupKey([]);
 * // ''
 * ```
 */
export function derivePathGroupKey(paths: readonly string[], depth: number = 1): string {
	if (!(Number.isInteger(depth) && depth > 0)) {
		throw new RangeError(
			`derivePathGroupKey: depth must be a positive integer, got ${depth}`,
		);
	}

	// See the trailing-slash note above.
	const segments = paths.filter((segment) => segment !== '');

	return segments.slice(0, depth).join('/');
}
