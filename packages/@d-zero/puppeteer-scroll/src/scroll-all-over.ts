import type { Page } from 'puppeteer';

export type Options = {
	distance?: number;
	interval?: number;
};

/**
 * Scrolls the page vertically until the end or a maximum height is reached.
 *
 * @param page - The Puppeteer page object.
 * @param options - Optional parameters for scrolling.
 * @param options.distance - The distance to scroll on each iteration (default: 100).
 * @param options.interval - The interval between each scroll iteration in milliseconds (default: 300).
 */
export async function scrollAllOver(page: Page, options?: Options) {
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
		options?.interval ?? 300,
	);
}
