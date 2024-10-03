import type { Listener, PageHook, Screenshot, Sizes } from './types.js';
import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';
import { defaultSizes } from '@d-zero/puppeteer-page-scan';
import { urlToFileName } from '@d-zero/shared/url-to-file-name';

import { getBinary } from './get-binary.js';

type Options = {
	id?: string;
	sizes?: Sizes;
	hooks?: readonly PageHook[];
	listener?: Listener;
	domOnly?: boolean;
	path?: string;
};

/**
 * Takes screenshots of a web page at different sizes and resolutions.
 *
 * @param page - The Puppeteer page object.
 * @param url - The URL of the web page to take screenshots of.
 * @param options - Optional settings for the screenshot process.
 * @param options.sizes - The sizes and resolutions to take screenshots at (default: desktop, tablet, mobile).
 * @param options.listener - A function that listens to the different phases of the screenshot process.
 * @returns A promise that resolves to an object containing the screenshots.
 */
export async function screenshot(page: Page, url: string, options?: Options) {
	const sizes = options?.sizes ?? defaultSizes;
	const listener = options?.listener;

	const result: Record<string, Screenshot> = {};

	for (const [name, { width, resolution }] of Object.entries(sizes)) {
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
			await page.reload({ waitUntil: 'networkidle0' });
		} else {
			listener?.('load', { name, type: 'open' });
			await page.goto(url, { waitUntil: 'networkidle0' });
		}

		for (const hook of options?.hooks ?? []) {
			await hook(page, {
				name,
				width,
				resolution,
				log: (message) => listener?.('hook', { name, message }),
			});
		}

		listener?.('scroll', { name });
		await scrollAllOver(page);

		let binary: Uint8Array | null = null;
		const filePath = options?.path?.replace(/\.png$/i, `-${name}.png`) ?? null;

		if (!options?.domOnly) {
			listener?.('screenshotStart', { name });
			try {
				if (filePath && options?.path) {
					listener?.('screenshotSaving', { name, path: options.path });
					await page.screenshot({
						path: filePath,
						fullPage: true,
						type: 'png',
					});
				} else {
					binary = await getBinary(page);
					listener?.('screenshotEnd', { name, binary });
				}
			} catch (error: unknown) {
				if (error instanceof Error) {
					listener?.('screenshotError', { name, error });
				} else {
					throw error;
				}
			}
		}

		listener?.('getDOMStart', { name });
		const title = await page.evaluate(() => document.title);
		const dom = await page.content();
		listener?.('getDOMEnd', { name, dom });

		result[name] = {
			id: options?.id ?? urlToFileName(url),
			filePath,
			url,
			title,
			binary,
			dom,
			width,
			resolution,
		};
	}

	return result;
}
