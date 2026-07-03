import type { DocumentFrequency } from './types.js';

/**
 * Default document-frequency cutoff: a token present in at least 90% of the
 * pages passed to `computeDocumentFrequency` is treated as site chrome.
 * Real-data validation against a small single-layout corporate site (a few
 * hundred pages) found the corpus's tokens cleanly bimodal — the same set
 * of chrome tokens was identified whether the cutoff was set anywhere from
 * 50% to 95% — so the exact value is not sensitive within that range for a
 * homogeneous corpus. 90% was picked as a value comfortably inside that
 * stable range rather than at either edge.
 */
const DEFAULT_TEMPLATE_FREQUENCY_THRESHOLD = 0.9;

/**
 * `threshold * pageCount` is a floating-point product and can overshoot the
 * intended integer boundary (verified: `0.55 * 100 === 55.00000000000001`
 * in JS), which would otherwise make a token at the exact documented
 * inclusive boundary (`frequency === threshold * pageCount`) fail the
 * `>=` check it should pass. Subtracting this epsilon before comparing
 * absorbs that rounding noise without being large enough to affect any
 * genuinely-below-threshold token (frequencies are integers, so the true
 * gap between "at the boundary" and "one below it" is always >= 1).
 */
const BOUNDARY_EPSILON = 1e-9;

/**
 * Splits one page's tokens into "template" (site chrome: header/nav/footer,
 * or any other structure repeated across most of the corpus) and "content"
 * (page-specific structure), using each token's document frequency from
 * `computeDocumentFrequency`. Comparing these two groups separately with
 * `jaccardSimilarity()` — rather than the page's full token set at once —
 * is what fixes two failures a single flat Jaccard has: common chrome
 * diluting genuine content differences at loose similarity thresholds, and
 * page-specific content differences (e.g. a freeform CMS block editor page,
 * where the exact block mix varies per page) swamping a real *layout*
 * match. See `computeDocumentFrequency`'s JSDoc for why `corpusFrequency`
 * must come from a homogeneous page collection for this split to work.
 *
 * `corpusFrequency` bundles `documentFrequency` with the `pageCount` it was
 * computed from (rather than taking `pageCount` as a separate argument) so
 * the two can never be passed out of sync — e.g. a caller re-slicing or
 * filtering the page list after computing frequencies but before using
 * them, which would otherwise silently produce a wrong cutoff with no error
 * raised anywhere.
 *
 * A token absent from `documentFrequency` is treated as frequency 0 (i.e.
 * content): it never appeared in the corpus the frequency map was built
 * from, so it cannot be corpus-wide chrome. If `pageCount` is 0 (empty
 * corpus), every token is classified as content for the same reason: with
 * no pages to have observed repetition across, nothing can be confirmed as
 * chrome.
 *
 * `threshold` must be a fraction in `(0, 1]`, not a percentage — passing
 * `90` instead of `0.9` would make the cutoff exceed every possible
 * frequency and misclassify even universal chrome as content, so this is
 * validated eagerly rather than left to fail silently downstream.
 * @param tokens
 * @param corpusFrequency
 * @param threshold
 * @example
 * ```ts
 * const corpusFrequency = computeDocumentFrequency(allPagesTokenSets);
 * splitTokensByFrequency(pageTokens, corpusFrequency);
 * // { templateTokens: Set(...), contentTokens: Set(...) }
 * ```
 */
export function splitTokensByFrequency(
	tokens: ReadonlySet<string>,
	corpusFrequency: DocumentFrequency,
	threshold: number = DEFAULT_TEMPLATE_FREQUENCY_THRESHOLD,
): { templateTokens: Set<string>; contentTokens: Set<string> } {
	if (!(threshold > 0 && threshold <= 1)) {
		throw new RangeError(
			`splitTokensByFrequency: threshold must be a fraction in (0, 1], got ${threshold}`,
		);
	}

	const { documentFrequency, pageCount } = corpusFrequency;
	const templateTokens = new Set<string>();
	const contentTokens = new Set<string>();

	if (pageCount === 0) {
		for (const token of tokens) {
			contentTokens.add(token);
		}
		return { templateTokens, contentTokens };
	}

	const cutoff = threshold * pageCount - BOUNDARY_EPSILON;
	for (const token of tokens) {
		const frequency = documentFrequency.get(token) ?? 0;
		if (frequency >= cutoff) {
			templateTokens.add(token);
		} else {
			contentTokens.add(token);
		}
	}

	return { templateTokens, contentTokens };
}
