import type { PageHook, PageScanPhase, Size } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { DelayOptions } from '@d-zero/shared/delay';
import type { Page } from 'puppeteer';

import { evaluateWithFrameRetry, scrollAllOver } from '@d-zero/puppeteer-scroll';

import { isFrameSettled } from './is-frame-settled.js';
import { NavigationUnsettledError } from './navigation-unsettled-error.js';

type Options = {
	name: string;
	hooks?: readonly PageHook[];
	listener?: Listener<PageScanPhase>;
	timeout?: number;
	openDisclosures?: boolean;
	scrollInterval?: number | DelayOptions;
	scrollDistance?: number | DelayOptions;
	/**
	 * Maximum `document.body.scrollHeight` (px) tolerated before `scrollAllOver`
	 * is skipped. Pages whose post-load scrollHeight exceeds this threshold
	 * return `{ scrolled: false, scrollHeight }` without scrolling, so callers
	 * can decide to abandon the device preset rather than letting the scroll
	 * run unbounded. Omit to disable the check (legacy behavior).
	 */
	maxScrollHeight?: number;
	/**
	 * When `true`, a `networkidle2` timeout does not fail outright: if the
	 * frame is still usable ({@link isFrameSettled}) navigation is treated as
	 * `settled: 'degraded'` and scanning continues on it. Defaults to `false`
	 * — every existing caller of `beforePageScan` before this option was
	 * added relies on a double timeout throwing, so opting in is required
	 * rather than silently changing their behavior. `@d-zero/beholder` passes
	 * `true` because it already isolates and reports per-viewport failures.
	 */
	continueOnDegradedNetwork?: boolean;
} & Size;

export type BeforePageScanResult = {
	/**
	 * `true` when `scrollAllOver` ran to completion (or to a stuck bail-out).
	 * `false` when the scroll was skipped because `scrollHeight` exceeded
	 * `maxScrollHeight`.
	 */
	scrolled: boolean;
	/** `document.body.scrollHeight` measured immediately before scroll. */
	scrollHeight: number;
	/**
	 * `'idle'` when the navigation (`page.goto`/`page.reload`) resolved via
	 * `networkidle0` or its `networkidle2` fallback. `'degraded'` when both
	 * timed out, `continueOnDegradedNetwork` was `true`, and the frame was
	 * still usable (see {@link isFrameSettled}) — scrolling and measurement
	 * proceeded on a page whose network activity never settled, so the
	 * resulting `scrollHeight` and any DOM state read afterward carry lower
	 * confidence than an `'idle'` result. Always `'idle'` unless
	 * `continueOnDegradedNetwork` is passed.
	 */
	settled: 'idle' | 'degraded';
};

/**
 * Open all disclosure elements on the page
 * This function loops until all disclosure elements are expanded,
 * including nested elements and dynamically-created buttons.
 * @param page
 * @returns The total number of elements opened (details + buttons)
 * @throws {Error} if the maximum iterations (1000) is reached
 */
async function openAllDisclosures(
	page: Page,
): Promise<{ details: number; buttons: number }> {
	const maxIterations = 1000; // Maximum iterations to prevent infinite loops
	let totalDetails = 0;
	let totalButtons = 0;
	let iteration = 0;

	while (iteration < maxIterations) {
		const result = await page.evaluate(() => {
			// Open all <details> elements
			const detailsElements =
				document.querySelectorAll<HTMLDetailsElement>('details:not([open])');
			for (const details of detailsElements) {
				details.open = true;
			}

			// Click all collapsed buttons
			const collapsedButtons = document.querySelectorAll<HTMLButtonElement>(
				'button[aria-expanded="false"]',
			);
			for (const button of collapsedButtons) {
				button.click();
			}

			return {
				details: detailsElements.length,
				buttons: collapsedButtons.length,
			};
		});

		totalDetails += result.details;
		totalButtons += result.buttons;

		// If no elements were opened in this iteration, we're done
		if (result.details === 0 && result.buttons === 0) {
			break;
		}

		// Wait for animations and content rendering before next iteration
		await new Promise((resolve) => setTimeout(resolve, 500));

		iteration++;
	}

	// If we reached the max iterations, throw an error
	if (iteration === maxIterations) {
		throw new Error(
			`openAllDisclosures: Reached maximum iterations (${maxIterations}). ` +
				`This may indicate an infinite loop caused by dynamically generated disclosure elements.`,
		);
	}

	return {
		details: totalDetails,
		buttons: totalButtons,
	};
}

/**
 * Navigates a page to `url` (via `page.goto` or `page.reload` if already
 * there), sets the requested viewport, runs any hooks and disclosure
 * expansion, then measures `document.body.scrollHeight` and scrolls the
 * full page.
 * @param page - Puppeteer page instance.
 * @param url - The URL to navigate to.
 * @param options - Viewport size, hooks, timeouts, and scroll limits.
 * @returns The scroll outcome and whether navigation settled cleanly. See
 * {@link BeforePageScanResult}.
 * @throws {NavigationUnsettledError} when `options.continueOnDegradedNetwork`
 * is `true`, navigation never reaches `networkidle0`/`networkidle2`, and the
 * post-timeout frame is not usable either (detached, wrong URL, or
 * `document` not past `loading`). Without that option, a double timeout
 * propagates as the underlying Puppeteer timeout error instead.
 * @example
 * ```ts
 * const { scrolled, scrollHeight, settled } = await beforePageScan(page, url, {
 *   name: 'mobile-small',
 *   width: 320,
 *   resolution: 2,
 * });
 * ```
 */
export async function beforePageScan(
	page: Page,
	url: string,
	options?: Options,
): Promise<BeforePageScanResult> {
	const listener = options?.listener;
	const name = options?.name ?? 'default';
	const width = options?.width ?? 1400;
	const resolution = options?.resolution;
	const timeout = options?.timeout || 5000;
	const maxScrollHeight = options?.maxScrollHeight;
	const continueOnDegradedNetwork = options?.continueOnDegradedNetwork ?? false;
	const countDownId = `${name}${url}_timeout`;

	listener?.('setViewport', { name, width, resolution });
	await page.setViewport({
		width,
		height:
			// Landscape or portrait
			width > 1000 ? Math.floor(width * 0.75) : Math.floor(width * 1.5),
		deviceScaleFactor: resolution ?? 1,
	});

	let settled: 'idle' | 'degraded';
	if (page.url() === url) {
		listener?.('load', { name, type: 'reload', timeout, id: countDownId });
		settled = await navigateWithFallback(
			page,
			url,
			timeout,
			true,
			listener,
			name,
			continueOnDegradedNetwork,
		);
	} else {
		listener?.('load', { name, type: 'open', timeout, id: countDownId });
		settled = await navigateWithFallback(
			page,
			url,
			timeout,
			false,
			listener,
			name,
			continueOnDegradedNetwork,
		);
	}

	for (const hook of options?.hooks ?? []) {
		await hook(page, {
			name,
			width,
			resolution,
			log: (message) => listener?.('hook', { name, message }),
		});
	}

	if (options?.openDisclosures) {
		listener?.('hook', { name, message: 'Opening all disclosures...' });
		const result = await openAllDisclosures(page);
		listener?.('hook', {
			name,
			message: `Opened ${result.details} <details> elements and clicked ${result.buttons} [aria-expanded="false"] buttons`,
		});
	}

	// WHY measure before scrollAllOver: pathological pages can have a
	// post-load scrollHeight of millions of pixels (e.g. responsive data
	// tables that expand to ~321k px at 320px viewport, and worse cases exist).
	// `scrollAllOver` has no upper bound, so without this guard it can run
	// for tens of minutes — long enough to exceed any reasonable retry
	// timeout, leaving the scroll's page.evaluate calls executing in the
	// background while the next retry attempts to use the same page.
	//
	// WHY retry on detached-Frame: this evaluation runs immediately after
	// `page.reload()` resolves, which is exactly when Chrome may still be
	// finishing an internal main-frame swap. A single read landing in that
	// window throws even though the page itself is doing nothing observable,
	// and the throw escapes `beforePageScan` before `scrollAllOver`'s own
	// retry layer can absorb anything. Reuse the same retry helper as
	// `scrollAllOver` to keep the swap-window absorption consistent.
	const scrollHeight = await evaluateWithFrameRetry(() =>
		page.evaluate(() => document.body.scrollHeight),
	);

	if (maxScrollHeight !== undefined && scrollHeight > maxScrollHeight) {
		listener?.('hook', {
			name,
			message: `Skipped scroll: scrollHeight ${scrollHeight} exceeds limit ${maxScrollHeight}`,
		});
		return { scrolled: false, scrollHeight, settled };
	}

	listener?.('scroll', {
		name,
		scrollY: 0,
		scrollHeight: Number.NaN,
		message: 'Start scrolling',
	});
	await scrollAllOver(page, {
		interval: options?.scrollInterval,
		distance: options?.scrollDistance,
		logger: (scrollY, scrollHeightCurrent, message) =>
			listener?.('scroll', { name, scrollY, scrollHeight: scrollHeightCurrent, message }),
	});

	return { scrolled: true, scrollHeight, settled };
}

/**
 * Navigates with a fallback from `networkidle0` to `networkidle2` on
 * timeout. When `continueOnDegradedNetwork` is `true` and `networkidle2`
 * also times out, checks whether the frame is nonetheless usable
 * ({@link isFrameSettled}) rather than failing outright — some pages
 * (analytics beacons, chat widgets, open WebSocket connections) never go
 * network-idle even though navigation itself completed. When `false`
 * (the default), a second timeout is re-thrown as-is, matching this
 * function's behavior before that option existed.
 * @param page - Puppeteer page instance.
 * @param url - The URL being navigated to (used for the post-timeout URL check).
 * @param timeout - `networkidle0` timeout in ms; `networkidle2` gets `timeout * 3`.
 * @param isReload - `true` to `page.reload()`, `false` to `page.goto(url)`.
 * @param listener - Optional phase listener for progress logging.
 * @param name - Device preset name, forwarded to `listener`.
 * @param continueOnDegradedNetwork - Opt-in to the degraded-continuation
 *   fallback described above.
 * @returns `'idle'` when a `waitUntil` promise resolved, `'degraded'` when
 * both timed out but `continueOnDegradedNetwork` is `true` and the frame was
 * still usable.
 * @throws {NavigationUnsettledError} when both timeouts elapse,
 * `continueOnDegradedNetwork` is `true`, and the frame is not usable.
 */
async function navigateWithFallback(
	page: Page,
	url: string,
	timeout: number,
	isReload: boolean,
	listener: Listener<PageScanPhase> | undefined,
	name: string,
	continueOnDegradedNetwork: boolean,
): Promise<'idle' | 'degraded'> {
	try {
		// First attempt: networkidle0 (stricter)
		if (isReload) {
			await page.reload({ waitUntil: 'networkidle0', timeout });
		} else {
			await page.goto(url, { waitUntil: 'networkidle0', timeout });
		}
		return 'idle';
	} catch (error) {
		// Check if it's a timeout error
		if (error instanceof Error && error.message.includes('timeout')) {
			listener?.('hook', {
				name,
				message: `networkidle0 timeout, retrying with networkidle2...`,
			});

			try {
				// Retry with networkidle2 (more lenient)
				if (isReload) {
					await page.reload({ waitUntil: 'networkidle2', timeout: timeout * 3 });
				} else {
					await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout * 3 });
				}
				return 'idle';
			} catch (fallbackError) {
				if (!continueOnDegradedNetwork) {
					throw fallbackError;
				}
				// Only a second timeout is eligible for the degraded fallback —
				// other errors (e.g. "Protocol error", detached frame) mean the
				// page/session itself is gone, not merely network-unsettled, so
				// they propagate unwrapped for the caller to classify as such.
				if (
					!(fallbackError instanceof Error) ||
					!fallbackError.message.includes('timeout')
				) {
					throw fallbackError;
				}
				if (await isFrameSettled(page, url)) {
					listener?.('hook', {
						name,
						message: 'networkidle2 timeout, continuing degraded — frame is usable',
					});
					return 'degraded';
				}
				throw new NavigationUnsettledError(fallbackError.message, {
					cause: fallbackError,
				});
			}
		} else {
			// Re-throw non-timeout errors
			throw error;
		}
	}
}
