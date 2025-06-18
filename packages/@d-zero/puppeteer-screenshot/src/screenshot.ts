import type { Screenshot, ScreenshotPhase } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { PageHook, Sizes } from '@d-zero/puppeteer-page-scan';
import type { Page, ScreenshotOptions } from 'puppeteer';

import { beforePageScan, defaultSizes } from '@d-zero/puppeteer-page-scan';
import { urlToFileName } from '@d-zero/shared/url-to-file-name';

import { getBinary } from './get-binary.js';

type Options = {
	id?: string;
	sizes?: Sizes;
	hooks?: readonly PageHook[];
	listener?: Listener<ScreenshotPhase>;
	domOnly?: boolean;
	path?: string;
	selector?: string;
};

/**
 * Takes screenshots of a web page at different sizes and resolutions.
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
		await beforePageScan(page, url, {
			...options,
			name,
			width,
			resolution,
			listener(phase, data) {
				listener?.(phase, data);
			},
		});

		let binary: Uint8Array | null = null;
		const filePath = options?.path?.replace(/\.png$/i, `@${name}.png`) ?? null;

		if (!options?.domOnly) {
			listener?.('screenshotStart', { name });
			try {
				if (filePath && options?.path) {
					listener?.('screenshotSaving', { name, path: options.path });
					const screenshotOptions: ScreenshotOptions = {
						path: filePath as `${string}.png`,
						fullPage: true,
						type: 'png',
					};

					if (options?.selector) {
						const element = await page.waitForSelector(options.selector);
						if (!element) {
							throw new Error(`Element not found: ${options.selector}`);
						}
						await element.screenshot(screenshotOptions);
					} else {
						await page.screenshot(screenshotOptions);
					}
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
		const text = await page.evaluate((selector) => {
			const scope = selector
				? (document.querySelector(selector) ?? document.body)
				: document.body;
			const textContent = scope.textContent ?? '';
			const altTextList = [...(scope.querySelectorAll('img') ?? [])]
				.map((img) => {
					const alt = img.getAttribute('alt');
					return alt ?? '';
				})
				.filter((alt) => alt !== '');
			return {
				textContent,
				altTextList,
			};
		}, options?.selector);
		listener?.('getDOMEnd', { name, dom });

		result[name] = {
			id: options?.id ?? urlToFileName(url),
			filePath,
			url,
			title,
			binary,
			dom,
			text,
			width,
			resolution,
		};
	}

	return result;
}
