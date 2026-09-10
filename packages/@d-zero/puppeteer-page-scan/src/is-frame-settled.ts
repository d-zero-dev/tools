import type { NavigationUnsettledError } from './navigation-unsettled-error.js';
import type { Page } from 'puppeteer';

import { evaluateWithFrameRetry } from '@d-zero/puppeteer-scroll';

/**
 * Normalizes a URL for the `isFrameSettled` comparison by dropping a
 * trailing `/` from the path (except the bare root `/`) and the hash.
 * Chrome normalizes a root navigation's `page.url()` to end in `/` (e.g.
 * `https://example.com` → `https://example.com/`) even when the requested
 * URL string omits it, so a plain `===` comparison would treat every
 * root-page navigation as a URL mismatch. Falls back to the raw string on a
 * parse failure (e.g. `about:blank`).
 * @param url - URL string to normalize.
 * @returns The normalized `origin + pathname + search`, or `url` unchanged
 * if it cannot be parsed as a URL.
 */
function normalizeForComparison(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname =
			parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname;
		return `${parsed.origin}${pathname}${parsed.search}`;
	} catch {
		return url;
	}
}

/**
 * Checks whether a page that failed to reach `networkidle2` before timeout
 * has nonetheless landed in a usable state: the main frame is attached, the
 * URL matches the navigation target, and the document has progressed past
 * `loading`. Used by `navigateWithFallback` to decide between surfacing a
 * {@link NavigationUnsettledError} and continuing as `'degraded'`.
 * @param page - Puppeteer page instance.
 * @param url - The URL that navigation was attempting to reach.
 * @returns `true` when the main frame is attached, `page.url()` matches
 * `url` (ignoring a trailing-slash/hash difference), and
 * `document.readyState` is `'interactive'` or `'complete'` with a
 * `document.body` present.
 * @example
 * ```ts
 * if (await isFrameSettled(page, url)) {
 *   return 'degraded';
 * }
 * throw new NavigationUnsettledError('Navigation never settled');
 * ```
 */
export async function isFrameSettled(page: Page, url: string): Promise<boolean> {
	if (page.mainFrame().isDetached()) {
		return false;
	}
	if (normalizeForComparison(page.url()) !== normalizeForComparison(url)) {
		return false;
	}
	try {
		return await evaluateWithFrameRetry(() =>
			page.evaluate(
				() =>
					(document.readyState === 'interactive' || document.readyState === 'complete') &&
					document.body !== null,
			),
		);
	} catch {
		// If the frame can't even answer this question (session/context gone
		// despite `isDetached()` reporting false, or `evaluateWithFrameRetry`
		// exhausted its retries), it is not settled — fail closed rather than
		// letting `navigateWithFallback` misclassify an actually-broken page
		// as `'degraded'`.
		return false;
	}
}
