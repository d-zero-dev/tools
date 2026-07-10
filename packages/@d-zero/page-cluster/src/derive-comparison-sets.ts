import { computeDocumentFrequency } from './compute-document-frequency.js';
import { splitTokensByFrequency } from './split-tokens-by-frequency.js';

/**
 * Below this many pages, `computeDocumentFrequency`/`splitTokensByFrequency`
 * (the default 90% cutoff) degenerate rather than usefully separate chrome
 * from content — see `deriveComparisonSets` for the failure mode. Derived
 * from `splitTokensByFrequency`'s own cutoff: a token missing from exactly
 * one page out of `n` still counts as chrome only if
 * `(n - 1) / n >= 0.9`, i.e. `n >= 10`. Below that, the caller should fall
 * back to comparing token sets directly, unfiltered.
 */
export const MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT = 10;

/**
 * Narrows each page's token set to its page-specific content before
 * clustering, so pages that only share site-wide chrome (header/nav/footer)
 * don't read as more similar than they structurally are. Skipped below
 * `MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT` pages — see that constant's JSDoc.
 *
 * A page whose entire token set narrows away falls back to its raw tokens
 * rather than the empty result, for the same reason documented in
 * `resolve-structural-cluster-keys.ts`.
 * @param tokenSets
 */
export function deriveComparisonSets(
	tokenSets: readonly ReadonlySet<string>[],
): readonly ReadonlySet<string>[] {
	if (tokenSets.length < MIN_PAGE_COUNT_FOR_FREQUENCY_SPLIT) {
		return tokenSets;
	}

	const corpusFrequency = computeDocumentFrequency(tokenSets);
	return tokenSets.map((tokens) => {
		const { contentTokens } = splitTokensByFrequency(tokens, corpusFrequency);
		return contentTokens.size === 0 && tokens.size > 0 ? tokens : contentTokens;
	});
}
