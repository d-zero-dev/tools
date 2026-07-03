import { hash } from '@d-zero/shared/hash';

import { HASH_LENGTH } from './hash-content.js';

/**
 * Derives a coarse grouping key from the set of stylesheet URLs a page
 * loads. This is a *blocking key* in the record-linkage sense (see
 * {@link ./derive-path-group-key.js | derivePathGroupKey}): pages sharing
 * the exact same stylesheet set are near-certainly the same template
 * family, making this a strong but sparse signal — many pages load few or
 * no stylesheets, so this key is meant to be used alongside, not instead
 * of, weaker-but-always-present signals like a URL-path-based key.
 *
 * `stylesheetHrefs` must already be resolved to a form that is comparable
 * across the whole corpus (e.g. absolute URLs). This function only compares
 * the strings it is given: two pages that both reference the same
 * unresolved relative href text (e.g. both link `href="style.css"`) but
 * from different directories, and would therefore load different physical
 * files, produce the same key here unless the caller has already resolved
 * each href against its page's URL before calling.
 *
 * Input order does not affect the result: the arrangement of `<link>` tags
 * in a document has no bearing on template identity, so hrefs are sorted
 * (and deduplicated, since a repeated href contributes no extra information
 * about what the page loads) before hashing. The sorted list is
 * JSON-serialized before hashing rather than joined with a plain delimiter
 * (e.g. `"\n"`) so that no character sequence inside one href can be
 * mistaken for a boundary between two hrefs. Hashing (via SHA-256, reusing
 * {@link ./hash-content.js | HASH_LENGTH} for the same truncation length the
 * package's other hashed keys use) keeps the key a fixed size regardless of
 * how many stylesheets a page loads or how long their URLs are.
 * @param stylesheetHrefs
 * @example
 * ```ts
 * deriveStylesheetGroupKey(['https://example.com/assets/site.css', 'https://example.com/assets/theme.css']);
 * deriveStylesheetGroupKey(['https://example.com/assets/theme.css', 'https://example.com/assets/site.css']);
 * // same result for both calls above — order-independent
 * ```
 */
export function deriveStylesheetGroupKey(stylesheetHrefs: readonly string[]): string {
	const sorted = [...new Set(stylesheetHrefs)].toSorted();
	return hash(JSON.stringify(sorted)).slice(0, HASH_LENGTH);
}
