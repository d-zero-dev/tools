import type { ExURL } from './parse-url.js';

import { tryParseUrl } from './parse-url.js';
import { pathMatch } from './path-match.js';

/**
 * Checks whether a URL partially matches a pattern URL. The match succeeds if both the
 * hostname (case-insensitive) and the pathname match. The pathname matches if it is exactly
 * equal to the pattern's pathname or if it falls under the pattern's pathname as a sub-path.
 * @param url - The URL string or ExURL to test.
 * @param pattern - The pattern URL string to match against (must include hostname and path).
 * @returns `true` if the URL's hostname matches the pattern's hostname and the URL's pathname
 *          is equal to or nested under the pattern's pathname; `false` otherwise.
 */
export function urlPartialMatch(url: string | ExURL, pattern: string) {
	const target = tryParseUrl(url);

	if (!target) {
		return false;
	}

	const patternUrl = tryParseUrl(pattern);
	if (!patternUrl) {
		return false;
	}

	const { hostname, pathname } = patternUrl;
	if (hostname.toLowerCase() !== target.hostname.toLowerCase()) {
		return false;
	}

	if (pathname === target.pathname) {
		return true;
	}

	if (pathMatch(url, `${pathname}/**/*`)) {
		return true;
	}

	return false;
}
