import type { ExURL, ParseURLOptions } from './parse-url.js';

import micromatch from 'micromatch';

import { tryParseUrl } from './parse-url.js';

/**
 * Tests whether the pathname portion of a URL matches a given glob pattern.
 * Uses micromatch for glob matching.
 * @param targetPath - The URL string or ExURL whose pathname will be tested.
 * @param pattern - The glob pattern to match against the pathname (e.g., `"/docs/**"`).
 * @param options - Optional URL parsing options.
 * @returns `true` if the URL's pathname matches the pattern; `false` otherwise
 *          (also returns `false` if the URL cannot be parsed).
 */
export function pathMatch(
	targetPath: string | ExURL,
	pattern: string,
	options?: ParseURLOptions,
) {
	const url =
		typeof targetPath === 'string' ? tryParseUrl(targetPath, options) : targetPath;
	if (!url) {
		return false;
	}

	return micromatch.isMatch(url.pathname || '', pattern || '/');
}
