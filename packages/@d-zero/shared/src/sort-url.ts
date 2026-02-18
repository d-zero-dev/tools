import type { ExURL, ParseURLOptions } from './parse-url.js';

import { tryParseUrl } from './parse-url.js';
import { pathComparator } from './sort/path.js';

/**
 * Parses, deduplicates, and sorts a list of URL strings using natural URL sorting.
 * Duplicate URLs (by normalized href) are removed before sorting.
 * @param list - An array of URL strings to sort.
 * @param options - Optional URL parsing options.
 * @returns A sorted array of ExURL objects with duplicates removed, ordered by
 *          natural URL sort (hostname, path hierarchy, basename, extension, query, hash).
 */
export function sortUrl(list: string[], options?: ParseURLOptions) {
	const map = new Map<string, ExURL>();
	for (const url of list) {
		if (map.has(url)) {
			continue;
		}
		const parsedUrl = tryParseUrl(url, options);
		if (!parsedUrl) {
			continue;
		}
		map.set(parsedUrl.href, parsedUrl);
	}

	return [...map.values()].toSorted((a, b) => pathComparator(a.href, b.href));
}
