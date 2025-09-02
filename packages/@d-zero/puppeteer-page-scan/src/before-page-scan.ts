import type { PageHook, PageScanPhase, Size } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';

type Options = {
	name: string;
	hooks?: readonly PageHook[];
	listener?: Listener<PageScanPhase>;
	timeout?: number;
} & Size;

/**
 *
 * @param page
 * @param url
 * @param options
 */
export async function beforePageScan(page: Page, url: string, options?: Options) {
	const listener = options?.listener;
	const name = options?.name ?? 'default';
	const width = options?.width ?? 1400;
	const resolution = options?.resolution;
	const timeout = options?.timeout;

	listener?.('setViewport', { name, width, resolution });
	await page.setViewport({
		width,
		height:
			// Landscape or portrait
			width > 1000 ? Math.floor(width * 0.75) : Math.floor(width * 1.5),
		deviceScaleFactor: resolution ?? 1,
	});

	if (page.url() === url) {
		listener?.('load', { name, type: 'reaload' });
		await navigateWithFallback(page, url, timeout, true, listener, name);
	} else {
		listener?.('load', { name, type: 'open' });
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

	listener?.('scroll', {
		name,
		scrollY: 0,
		scrollHeight: Number.NaN,
		message: 'Start scrolling',
	});
	await scrollAllOver(page, {
		logger: (scrollY, scrollHeight, message) =>
			listener?.('scroll', { name, scrollY, scrollHeight, message }),
	});
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
	timeout: number | undefined,
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
				await page.reload({ waitUntil: 'networkidle2', timeout });
			} else {
				await page.goto(url, { waitUntil: 'networkidle2', timeout });
			}
		} else {
			// Re-throw non-timeout errors
			throw error;
		}
	}
}
