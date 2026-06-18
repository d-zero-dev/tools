import type { Page } from 'puppeteer';

import { delay, type DelayOptions } from '@d-zero/shared/delay';

import { evaluateWithFrameRetry } from './evaluate-with-frame-retry.js';
import { resolveValue } from './resolve-value.js';

/**
 * Number of consecutive iterations without scroll progress before bailing out.
 *
 * Scroll-jacking libraries (e.g. fullpage.js) can block `scrollBy` while
 * `body.scrollHeight` remains larger than the viewport, causing an infinite
 * loop. Three stuck iterations (≈ 1.05 s at the default interval mean) is
 * enough to confirm that scrolling is genuinely blocked.
 */
const MAX_STUCK_ITERATIONS = 3;

/**
 * Default interval range (ms) used when `options.interval` is omitted.
 * Randomized to mimic human-like reading pauses while staying close to the
 * historical 300 ms fixed default.
 */
const DEFAULT_INTERVAL: DelayOptions = { random: { min: 200, max: 500 } };

/**
 * Default scroll-step ratio range applied to `clientHeight` when
 * `options.distance` is omitted. Sampled in the browser context per iteration
 * so it adapts to the current viewport height.
 */
const DEFAULT_DISTANCE_RATIO_MIN = 0.5;
const DEFAULT_DISTANCE_RATIO_MAX = 1;

export type Options = {
	distance?: number | DelayOptions;
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
 * @param options.distance - The distance to scroll on each iteration in pixels.
 *   Accepts a fixed number or a random range via `{ random: ... }`. When omitted,
 *   each step uses `clientHeight × random(0.5, 1.0)` so it adapts to the viewport.
 * @param options.interval - The interval between each scroll iteration in
 *   milliseconds. Accepts a fixed number or a random range via `{ random: ... }`.
 *   When omitted, defaults to a random range of 200–500 ms.
 * @param options.logger - A function that logs messages.
 */
export async function scrollAllOver(page: Page, options?: Options) {
	const interval = options?.interval ?? DEFAULT_INTERVAL;
	const distance = options?.distance;

	let currentScrollY = 0;
	let scrollHeight = await evaluateWithFrameRetry(() =>
		page.evaluate(() => document.body.scrollHeight),
	);
	let prevScrollY = -1;
	let stuckCount = 0;

	while (Math.ceil(currentScrollY) < Math.ceil(scrollHeight)) {
		// Force a minimum of 1 px so a user-supplied 0/negative distance
		// cannot stall the loop into the stuck-detection bail out.
		const stepDistance =
			distance === undefined ? null : Math.max(1, resolveValue(distance));
		[currentScrollY, scrollHeight] = await evaluateWithFrameRetry(() =>
			page.evaluate(
				(step, ratioMin, ratioMax) => {
					// When step is null, sample a random fraction of the viewport
					// height so each scroll feels less mechanical.
					const actualStep =
						step ??
						Math.max(
							1,
							Math.floor(
								document.documentElement.clientHeight *
									(ratioMin + Math.random() * (ratioMax - ratioMin)),
							),
						);
					globalThis.scrollBy(0, actualStep);
					return [
						Math.ceil(globalThis.scrollY + globalThis.innerHeight),
						Math.ceil(document.body.scrollHeight),
					] as const;
				},
				stepDistance,
				DEFAULT_DISTANCE_RATIO_MIN,
				DEFAULT_DISTANCE_RATIO_MAX,
			),
		);
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

	await evaluateWithFrameRetry(() =>
		page.evaluate(() => {
			// Move the scroll position to the top of the page.
			globalThis.scrollTo(0, 0);
		}),
	);
	await delay(400);

	options?.logger?.(currentScrollY, scrollHeight, 'End of page');

	await delay(400);
}
