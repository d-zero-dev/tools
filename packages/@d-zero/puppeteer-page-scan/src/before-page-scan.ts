import type { PageHook, PageScanPhase, Size } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { DelayOptions } from '@d-zero/shared/delay';
import type { Page } from 'puppeteer';

import { evaluateWithFrameRetry, scrollAllOver } from '@d-zero/puppeteer-scroll';

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
 *
 * @param page
 * @param url
 * @param options
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
	const countDownId = `${name}${url}_timeout`;

	listener?.('setViewport', { name, width, resolution });
	await page.setViewport({
		width,
		height:
			// Landscape or portrait
			width > 1000 ? Math.floor(width * 0.75) : Math.floor(width * 1.5),
		deviceScaleFactor: resolution ?? 1,
	});

	if (page.url() === url) {
		listener?.('load', { name, type: 'reload', timeout, id: countDownId });
		await navigateWithFallback(page, url, timeout, true, listener, name);
	} else {
		listener?.('load', { name, type: 'open', timeout, id: countDownId });
		await navigateWithFallback(page, url, timeout, false, listener, name);
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
		return { scrolled: false, scrollHeight };
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

	return { scrolled: true, scrollHeight };
}

/**
 * Navigate with fallback from networkidle0 to networkidle2 on timeout
 * @param page
 * @param url
 * @param timeout
 * @param isReload
 * @param listener
 * @param name
 */
async function navigateWithFallback(
	page: Page,
	url: string,
	timeout: number,
	isReload: boolean,
	listener: Listener<PageScanPhase> | undefined,
	name: string,
) {
	try {
		// First attempt: networkidle0 (stricter)
		if (isReload) {
			await page.reload({ waitUntil: 'networkidle0', timeout });
		} else {
			await page.goto(url, { waitUntil: 'networkidle0', timeout });
		}
	} catch (error) {
		// Check if it's a timeout error
		if (error instanceof Error && error.message.includes('timeout')) {
			listener?.('hook', {
				name,
				message: `networkidle0 timeout, retrying with networkidle2...`,
			});

			// Retry with networkidle2 (more lenient)
			if (isReload) {
				await page.reload({ waitUntil: 'networkidle2', timeout: timeout * 3 });
			} else {
				await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout * 3 });
			}
		} else {
			// Re-throw non-timeout errors
			throw error;
		}
	}
}
