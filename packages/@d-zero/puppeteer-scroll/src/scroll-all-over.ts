import type { Page } from 'puppeteer';

import { delay, type DelayOptions } from '@d-zero/shared/delay';

/**
 * Number of consecutive iterations without scroll progress before bailing out.
 *
 * Scroll-jacking libraries (e.g. fullpage.js) can block `scrollBy` while
 * `body.scrollHeight` remains larger than the viewport, causing an infinite
 * loop. Three stuck iterations (≈ 900 ms at the default interval) is enough
 * to confirm that scrolling is genuinely blocked.
 */
const MAX_STUCK_ITERATIONS = 3;

export type Options = {
	distance?: number;
	interval?: number | DelayOptions;
	logger?: (scrollY: number, scrollHeight: number, message: string) => void;
};

/**
 * Scrolls the page vertically until the end or a maximum height is reached.
 *
 * Detects stuck scrolling (e.g. fullpage.js or other scroll-jacking libraries
 * that block `scrollBy` while `body.scrollHeight` exceeds the viewport) and
 * bails out after {@link MAX_STUCK_ITERATIONS} consecutive iterations without
 * progress.
 * @param page - The Puppeteer page object.
 * @param options - Optional parameters for scrolling.
 * @param options.distance - The distance to scroll on each iteration (default: 100).
 * @param options.interval - The interval between each scroll iteration in milliseconds (default: 300).
 * @param options.logger - A function that logs messages.
 */
export async function scrollAllOver(page: Page, options?: Options) {
	const interval = options?.interval ?? 300;

	let currentScrollY = 0;
	let scrollHeight = await page.evaluate(() => document.body.scrollHeight);
	let prevScrollY = -1;
	let stuckCount = 0;

	while (Math.ceil(currentScrollY) < Math.ceil(scrollHeight)) {
		[currentScrollY, scrollHeight] = await page.evaluate(() => {
			// Move the scroll position to the bottom of the page.
			globalThis.scrollBy(0, document.documentElement.clientHeight);
			// Return the current scroll position.
			return [
				Math.ceil(globalThis.scrollY + globalThis.innerHeight),
				Math.ceil(document.body.scrollHeight),
			] as const;
		});
		options?.logger?.(currentScrollY, scrollHeight, 'Scrolling');

		if (currentScrollY === prevScrollY) {
			stuckCount++;
			if (stuckCount >= MAX_STUCK_ITERATIONS) {
				options?.logger?.(currentScrollY, scrollHeight, 'Scroll stuck, bailing out');
				break;
			}
		} else {
			stuckCount = 0;
		}
		prevScrollY = currentScrollY;

		await delay(interval);
	}

	options?.logger?.(currentScrollY, scrollHeight, 'End of page');

	await page.evaluate(() => {
		// Move the scroll position to the top of the page.
		globalThis.scrollTo(0, 0);
	});
	await delay(400);

	options?.logger?.(currentScrollY, scrollHeight, 'End of page');

	await delay(400);
}
