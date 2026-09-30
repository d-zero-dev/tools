/**
 * Minimum number of pages a class name must occur on before it can be
 * template structure. A template's classes recur on every page rendered from
 * it, so a class present on exactly one page of a pool cannot be part of the
 * pool's shared structure — it is a page identifier (a per-page label on the
 * content root, a one-off editorial widget) or a genuinely unique section.
 * `2` is the smallest count at which "shared" is even definable; it is an
 * absolute floor, not a fraction of the pool, because the property being
 * tested ("appears on more than one page") does not scale with pool size.
 */
const MIN_PAGES_PER_RECURRING_CLASS = 2;

/**
 * Returns the set of class names that occur on at least two of the given
 * pages.
 *
 * Each entry of `classLists` is one page's `TokenizeResult.classList`. The
 * result is meant to be fed back to `tokenize` as `allowedClasses` for the
 * same pages (and, on a sampled path, for further pages of the same pool):
 * classes seen on a single page are then dropped *before* segments are
 * built, so a per-page identity class on a content root (e.g.
 * `<article class="outline">` vs `<article class="weather">`) does not
 * prefix — and thereby differentiate — every root-to-leaf path beneath it.
 * Confirmed on a real crawl: two pages sharing the same shell and near-
 * identical content skeleton compared at Jaccard 0.08 solely because each
 * carried its own page-name class on the content `<article>`; with those
 * classes removed they and three sibling pages clustered together.
 *
 * The full recurring set is returned even when no class was excluded (every
 * class already recurs) rather than a sentinel meaning "nothing to strip":
 * a caller that later tokenizes pages *outside* the pool it was computed
 * from (the streaming Pass 1b path) needs an actual allow-list to apply to
 * those pages, and a sentinel would silently turn into "keep every class"
 * for them while the pool's own members had been filtered — the exact
 * asymmetry an allow-list exists to prevent. The empty set (no page has any
 * class, or every class is page-unique) is likewise a real answer.
 *
 * Why this is *not* a frequency auto-cut like `splitTokensByFrequency`: the
 * question is not "which classes are chrome" but "which classes are evidence
 * of anything at all". A class on one page carries no cross-page signal by
 * construction, whatever the pool size, so a fixed absolute floor is the
 * correct rule; a max-gap cut over class frequencies was measured on the same
 * crawl and collapsed to the 0.8 clamp (no usable gap), leaving the identity
 * classes in place.
 * @param classLists
 * @example
 * ```ts
 * resolveRecurringClasses([
 * 	['card', 'grid', 'outline'],
 * 	['card', 'grid', 'weather'],
 * 	['card', 'history'],
 * ]);
 * // Set { 'card', 'grid' } — 'outline' / 'weather' / 'history' each occur on one page only
 *
 * resolveRecurringClasses([['card'], ['card']]);
 * // Set { 'card' } — every class recurs; the set is still returned as the allow-list
 * ```
 */
export function resolveRecurringClasses(
	classLists: readonly (readonly string[])[],
): ReadonlySet<string> {
	const pageCountByClass = new Map<string, number>();
	for (const classList of classLists) {
		// A page's classList is already deduplicated, but guard anyway so a
		// caller passing raw per-element lists cannot inflate a single page
		// into "two occurrences".
		for (const className of new Set(classList)) {
			pageCountByClass.set(className, (pageCountByClass.get(className) ?? 0) + 1);
		}
	}

	const recurring = new Set<string>();
	for (const [className, pageCount] of pageCountByClass) {
		if (pageCount >= MIN_PAGES_PER_RECURRING_CLASS) {
			recurring.add(className);
		}
	}

	return recurring;
}
