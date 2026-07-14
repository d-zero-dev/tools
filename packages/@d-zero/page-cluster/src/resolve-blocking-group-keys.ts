import { computeDocumentFrequency } from './compute-document-frequency.js';
import { derivePathClusterKeys } from './derive-path-cluster-keys.js';
import { derivePathGroupKey } from './derive-path-group-key.js';
import { deriveStylesheetGroupKey } from './derive-stylesheet-group-key.js';
import { splitTokensByFrequency } from './split-tokens-by-frequency.js';

/**
 * The two blocking signals {@link ./derive-path-group-key.js | derivePathGroupKey}
 * and {@link ./derive-stylesheet-group-key.js | deriveStylesheetGroupKey} need,
 * bundled per page so `resolveBlockingGroupKeys` can compute both without the
 * caller re-deriving them separately.
 */
export type PageBlockingSignals = {
	paths: readonly string[];
	stylesheetHrefs: readonly string[];
};

/**
 * @see resolveBlockingGroupKeys
 */
export type ResolveBlockingGroupKeysOptions = {
	/**
	 * Forwarded to `derivePathGroupKey` when a number, which is the historical
	 * default. Set to `'auto'` to instead run
	 * {@link ./derive-path-cluster-keys.js | derivePathClusterKeys} on the
	 * corpus and let it pick the depth data-driven — see that function's
	 * JSDoc for the algorithm and its opt-in staging rationale.
	 */
	pathDepth?: number | 'auto';
	/**
	 * Minimum number of pages that must share a stylesheet-derived key before
	 * it's trusted as real evidence, rather than a coincidence. Must be at
	 * least 2: a page always "shares" its own key with itself, so 1 would
	 * accept every stylesheet-bearing page unconditionally and make this
	 * check a no-op. This is a structural floor (below 2, no pair of distinct
	 * pages can exist at all), not a statistically-derived
	 * confidence threshold — entity-resolution blocking literature has no
	 * closed-form value for "how many shared pages prove a true match", so
	 * this is a starting default to be tuned against real corpora, not a
	 * validated constant.
	 */
	minCssGroupSize?: number;
	/** Forwarded to `splitTokensByFrequency` as-is. */
	hrefCommonThreshold?: number;
};

const DEFAULT_MIN_CSS_GROUP_SIZE = 2;

/**
 * Resolves, per page, which of the two independent blocking signals — the
 * exact stylesheet set or the URL path — to actually use as that page's
 * grouping key. Returns one key per page, in the same order as `pages`.
 *
 * Literature on entity-resolution blocking (Michelson & Knoblock's DNF
 * scheme, canopy clustering, ensemble blocking) combines independent
 * blocking predicates with OR to generate *candidate pairs* for a later
 * similarity/classification pass. This function instead commits each page to
 * exactly one final key: `resolve-page-cluster-keys.js`'s
 * `resolvePageClusterKeys` *does* run a later refinement step
 * (`resolveStructuralClusterKeys`) on top of whichever key a page lands on,
 * but only within that one key's candidate pool — it has no way to pull in
 * a page that this function routed to a different key. So this function's
 * per-page choice is still effectively final for blocking purposes: a page
 * assigned to the wrong key here never re-enters the correct key's pool
 * downstream. A true OR-merge (letting a page carry both the stylesheet and
 * path candidates, deferring to the refinement step to reconcile overlapping
 * results across them) would close that gap, but is deliberately deferred —
 * it needs the same literature-plus-real-data validation cycle this
 * package's linkage-criterion and NN-chain choices already went through, not
 * a change bundled in alongside unrelated fixes. Until then, a
 * priority-with-fallback decision — try the strong signal, fall back to the
 * weak one — is the applicable pattern here, not OR-merge: a union of
 * equivalence relations can only ever coarsen a partition, never split it,
 * but the whole point of preferring the stylesheet signal is that it *splits*
 * pages a URL-path-only grouping would otherwise lump together (confirmed
 * against real crawl data: a single page embedded under an otherwise-uniform
 * URL section, but loading a completely different stylesheet set, is exactly
 * the case a path-only key misses and a stylesheet key catches).
 *
 * Before comparing stylesheet sets, this reuses
 * {@link ./compute-document-frequency.js | computeDocumentFrequency} and
 * {@link ./split-tokens-by-frequency.js | splitTokensByFrequency} — originally
 * built to separate a page's site-wide chrome from its page-specific HTML
 * structure — to strip stylesheet hrefs that recur across most of `pages`
 * (e.g. a shared reset/font stylesheet) before hashing. Without this, two
 * pages from otherwise-unrelated sections that happen to load only that one
 * shared stylesheet would satisfy `minCssGroupSize` and be wrongly treated as
 * the same template family: the problem there isn't too few pages sharing
 * the key (raising `minCssGroupSize` doesn't fix it), it's that the key
 * itself carries no discriminative information. A page whose stylesheet set
 * is empty, or becomes empty after this filtering, always falls back to the
 * path key — loading no distinctive stylesheet is an absence of evidence,
 * not evidence of a shared template, so it must never itself become a
 * matching signal.
 *
 * Document frequency is computed only over pages that load at least one
 * stylesheet: including stylesheet-less pages in the denominator would dilute
 * every href's frequency ratio (e.g. a stylesheet loaded by 100% of the pages
 * that load *any* stylesheet would read as a low, "distinctive" frequency if
 * most pages in the batch load none), letting a genuinely non-discriminative,
 * site-wide stylesheet slip through the common-href filter.
 *
 * Like `computeDocumentFrequency` itself, this expects `pages` to be a
 * roughly homogeneous batch (one site, or one section of a large
 * multi-template site) — see that function's JSDoc for why a federation of
 * independently-templated sub-sections defeats frequency-based filtering.
 * Splitting a heterogeneous crawl into sections before calling this function
 * is the caller's responsibility.
 *
 * This filtering needs enough stylesheet-bearing pages to tell "loaded by
 * every page that has any stylesheet" apart from "coincidentally the only
 * stylesheet two pages happen to load": with only two stylesheet-bearing
 * pages in the whole batch and nothing else to contrast against, any
 * stylesheet they share reads as 100% common and gets filtered out,
 * producing a path-key fallback even when the two pages are a genuine
 * template match. A third, differently-styled page (as in the example below)
 * is what gives the shared stylesheet a frequency below the common-href
 * cutoff.
 * @param pages
 * @param options
 * @example
 * ```ts
 * resolveBlockingGroupKeys([
 * 	{ paths: ['dept-a', 'news', '1'], stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'] },
 * 	{ paths: ['dept-a', 'news', '2'], stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/common.css'] },
 * 	{ paths: ['dept-b', 'about'], stylesheetHrefs: ['https://example.com/common.css'] },
 * ]);
 * // ['css:<hash of a.css>', 'css:<hash of a.css>', 'path:dept-b']
 * // common.css is loaded by all 3 pages and is filtered out as non-discriminative chrome.
 * ```
 */
export function resolveBlockingGroupKeys(
	pages: readonly PageBlockingSignals[],
	options?: ResolveBlockingGroupKeysOptions,
): string[] {
	const pathDepthOption = options?.pathDepth;
	const minCssGroupSize = options?.minCssGroupSize ?? DEFAULT_MIN_CSS_GROUP_SIZE;
	const hrefCommonThreshold = options?.hrefCommonThreshold;

	if (!(Number.isInteger(minCssGroupSize) && minCssGroupSize >= 2)) {
		throw new RangeError(
			`resolveBlockingGroupKeys: minCssGroupSize must be an integer >= 2, got ${minCssGroupSize}`,
		);
	}
	// Eagerly delegate pathDepth/hrefCommonThreshold validation to the
	// functions that own it, instead of only discovering an invalid option
	// once some page's data happens to reach that branch below. `'auto'`
	// skips validation here because it doesn't reach derivePathGroupKey's
	// number-only signature until per-page fallback below.
	if (pathDepthOption !== 'auto') {
		derivePathGroupKey([], pathDepthOption);
	}
	splitTokensByFrequency(
		new Set(),
		{ documentFrequency: new Map(), pageCount: 0 },
		hrefCommonThreshold,
	);

	// Resolve `pathDepth: 'auto'` to a data-driven per-page key list once,
	// before the per-page loop below, so the auto-cut sweep is amortized
	// over the whole call rather than repeated per page.
	const perPagePathKeys =
		pathDepthOption === 'auto'
			? derivePathClusterKeys(pages.map((page) => page.paths)).keys
			: null;

	const hrefSets = pages.map((page) => new Set(page.stylesheetHrefs));
	// Pages with no stylesheets at all must not count toward the denominator:
	// see the JSDoc note above on document-frequency dilution.
	const corpusFrequency = computeDocumentFrequency(
		hrefSets.filter((hrefSet) => hrefSet.size > 0),
	);

	const distinctiveHrefs = hrefSets.map(
		(hrefSet) =>
			splitTokensByFrequency(hrefSet, corpusFrequency, hrefCommonThreshold).contentTokens,
	);

	const cssKeys = distinctiveHrefs.map((hrefs) =>
		hrefs.size === 0 ? undefined : deriveStylesheetGroupKey([...hrefs]),
	);

	const cssKeyCounts = new Map<string, number>();
	for (const cssKey of cssKeys) {
		if (cssKey !== undefined) {
			cssKeyCounts.set(cssKey, (cssKeyCounts.get(cssKey) ?? 0) + 1);
		}
	}

	return pages.map((page, index) => {
		const cssKey = cssKeys[index];
		if (cssKey !== undefined && (cssKeyCounts.get(cssKey) ?? 0) >= minCssGroupSize) {
			return `css:${cssKey}`;
		}
		const pathKey =
			perPagePathKeys === null
				? derivePathGroupKey(page.paths, pathDepthOption as number | undefined)
				: (perPagePathKeys[index] ?? '');
		return `path:${pathKey}`;
	});
}
