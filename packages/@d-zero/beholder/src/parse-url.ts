import type { ExURL, ParseURLOptions } from '@d-zero/shared/parse-url';

import { parseUrl as sharedParseUrl } from '@d-zero/shared/parse-url';

/**
 * Parses a URL string into an ExURL object, filtering out non-HTTP URLs
 * that lack a hostname and protocol. If the input is already an ExURL object,
 * it is returned as-is without re-parsing.
 *
 * WHY null return: Bare fragment-only strings (e.g. `"#section"`) and
 * protocol-relative paths without a host are not meaningful URLs for crawling.
 * @param url - A URL string or an already-parsed ExURL object
 * @param options - URL parsing options (e.g. `disableQueries` to strip query strings)
 * @returns The parsed ExURL, or `null` if the URL is not navigable
 * @see `@d-zero/shared/parse-url` for the underlying parser
 */
export function parseUrl(url: string | ExURL, options?: ParseURLOptions): ExURL | null {
	if (typeof url !== 'string') {
		return url;
	}
	const result = sharedParseUrl(url, options);
	if (!result.isHTTP && !result.hostname && !result.protocol) {
		return null;
	}
	return result;
}
