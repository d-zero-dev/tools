import type { Page } from 'puppeteer';

import { delay } from '@d-zero/shared/delay';

export type Options = {
	distance?: number;
	interval?: number;
	accurate?: boolean;
	logger?: (scrollY: number, scrollHeight: number, message: string) => void;
};

/**
 * Scrolls the page vertically until the end or a maximum height is reached.
 *
 * @param page - The Puppeteer page object.
 * @param options - Optional parameters for scrolling.
 * @param options.distance - The distance to scroll on each iteration (default: 100).
 * @param options.interval - The interval between each scroll iteration in milliseconds (default: 300).
 * @param options.accurate
 * @param options.logger - A function that logs messages.
 */
export async function scrollAllOver(page: Page, options?: Options) {
	const interval = options?.interval ?? 300;

	if (options?.accurate) {
		let currentScrollY = 0;
		let scrollHeight = await page.evaluate(() => document.body.scrollHeight);

		while (currentScrollY < scrollHeight) {
			[currentScrollY, scrollHeight] = await page.evaluate(() => {
				// Move the scroll position to the bottom of the page.
				globalThis.scrollBy(0, document.documentElement.clientHeight);
				// Return the current scroll position.
				return [
					globalThis.scrollY + globalThis.innerHeight,
					document.body.scrollHeight,
				] as const;
			});
			options?.logger?.(currentScrollY, scrollHeight, 'Scrolling');
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

		return;
	}

	options?.logger?.(Number.NaN, Number.NaN, 'Scrolling (Inaccurate Mode)');

	await page.evaluate(
		async (distance, interval) => {
			distance = distance ?? document.documentElement.clientHeight - 5;
			await new Promise<void>((resolve) => {
				let totalHeight = 0;
				const timer = setInterval(() => {
					const scrollHeight = document.body.scrollHeight;
					window.scrollBy(0, distance);
					totalHeight += distance;
					if (totalHeight >= scrollHeight || totalHeight >= 100_000) {
						clearInterval(timer);
						window.scrollBy(0, 0);
						resolve();
					}
				}, interval);
			});
		},
		options?.distance,
		interval,
	);
}
