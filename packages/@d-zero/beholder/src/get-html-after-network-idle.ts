import type { Page } from 'puppeteer';

import { awaitPageNetworkIdle } from './await-page-network-idle.js';

/**
 * Settles in-flight network activity on the current page, then reads
 * `document.title` and `document.documentElement.outerHTML`.
 *
 * WHY compose wait + evaluate: Callers must not snapshot HTML before idle.
 * Keeping both steps in one function makes that order enforceable in unit
 * tests without loading `Scraper` (vitest cannot transform `@retryable` on
 * `#fetchData`).
 *
 * WHY not wait for pure `setTimeout` DOM updates: Settle is network-linked
 * only (`waitForNetworkIdle`). Timer-only mutations after quiet network are
 * outside this contract.
 * @param page - Puppeteer page already navigated to the target URL
 * @param beforeEvaluate - Optional hook after idle settles and before the
 *   HTML `evaluate` (used by `Scraper` to emit `getHTML` at the right time)
 * @returns Page title and HTML snapshot after the idle attempt
 * @example
 * ```ts
 * const { title, html } = await getHtmlAfterNetworkIdle(page);
 * ```
 */
export async function getHtmlAfterNetworkIdle(
	page: Page,
	beforeEvaluate?: () => void,
): Promise<{ title: string; html: string }> {
	await awaitPageNetworkIdle(page);
	beforeEvaluate?.();
	return page.evaluate(() => {
		/* global document */
		return {
			title: document.title,
			html: document.documentElement.outerHTML,
		};
	});
}
