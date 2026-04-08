import type { ExURL, ParseURLOptions } from './parse-url.js';

import { tryParseUrl } from './parse-url.js';

/**
 * Determines whether the target URL is at the same level or a deeper (lower) layer
 * in the path hierarchy relative to the base URL. Both URLs must share the same hostname.
 *
 * For example, if the base is `https://example.com/docs/`, then
 * `https://example.com/docs/getting-started` is considered a lower layer,
 * while `https://example.com/about` is not.
 * @param target - The target URL string or ExURL to check.
 * @param base - The base URL string or ExURL to compare against.
 * @param options - Optional URL parsing options.
 * @returns `true` if the target URL is at the same level or deeper than the base URL
 *          within the same hostname; `false` otherwise.
 */
export function isLowerLayer(
	target: string | ExURL,
	base: string | ExURL,
	options?: ParseURLOptions,
) {
	const a = typeof target === 'string' ? tryParseUrl(target, options) : target;
	const b = typeof base === 'string' ? tryParseUrl(base, options) : base;
	if (!a || !b) {
		return false;
	}

	if (a.href === b.href) {
		return true;
	}

	const aPathIsEmpty = a.paths.length === 1 && a.paths[0] === '';
	const bPathIsEmpty = b.paths.length === 1 && b.paths[0] === '';
	if (a.hostname !== b.hostname) {
		return false;
	}

	if (aPathIsEmpty && bPathIsEmpty) {
		return true;
	}

	if (a.paths == null && b.paths == null) {
		return true;
	}

	if (a.paths && b.paths == null) {
		return true;
	}

	if (!a.paths || !b.paths) {
		return false;
	}

	if (a.paths.length < b.paths.length) {
		return false;
	}

	for (let i = 0; i < Math.max(a.paths.length, b.paths.length); i++) {
		const i1 = a.paths[i];
		const i2 = b.paths[i];
		if (i1 && !i2) {
			return true;
		}
		if (i1 !== i2) {
			return false;
		}
	}

	return false;
}
