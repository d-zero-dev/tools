import type { DocumentFrequency } from './types.js';

/**
 * Counts, for each token, how many of the given per-page token sets contain
 * it. This is the first half of separating a page's shared site chrome
 * (header/nav/footer) from its page-specific content: a token that recurs
 * across nearly every page in `tokenSets` is chrome, one that shows up on
 * only a handful of pages is content — see `splitTokensByFrequency`, which
 * consumes this result to make that call per token.
 *
 * `tokenSets` must be a *homogeneous* page collection (typically one site,
 * or one section of a large multi-template site), not an arbitrary pool.
 * Real-data validation against a small single-layout corporate site (a few
 * hundred pages) found a clean bimodal frequency split (site chrome tokens
 * showed up on 95%+ of pages, content tokens on well under 50%, with
 * nothing in between). The same computation against the *whole* crawl of a
 * much larger site that turned out to be a federation of independent
 * sub-sections (the largest covering under half of all pages) found no
 * token crossing even a 50% document-frequency threshold: with no single
 * dominant layout, frequency-based chrome detection needs a mostly-
 * homogeneous input to work at all. Splitting such a site into its
 * sections first (by URL path, or by a coarse structural clustering pass)
 * and calling this function per section recovered the same clean bimodal
 * split. Grouping heterogeneous pages before calling this function is the
 * caller's responsibility; this function has no way to detect that its
 * input mixes multiple layouts.
 * @param tokenSets
 * @example
 * ```ts
 * computeDocumentFrequency([new Set(['body>header>a']), new Set(['body>header>a'])]);
 * // { documentFrequency: Map { 'body>header>a' => 2 }, pageCount: 2 }
 * ```
 */
export function computeDocumentFrequency(
	tokenSets: readonly ReadonlySet<string>[],
): DocumentFrequency {
	const documentFrequency = new Map<string, number>();
	for (const tokens of tokenSets) {
		for (const token of tokens) {
			documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
		}
	}
	return { documentFrequency, pageCount: tokenSets.length };
}
