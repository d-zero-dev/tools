import type { Screenshot, ScreenshotPhase } from './types.js';
import type { Listener } from '@d-zero/puppeteer-general-actions';
import type { PageHook, Sizes } from '@d-zero/puppeteer-page-scan';
import type { DelayOptions } from '@d-zero/shared/delay';
import type { Page } from 'puppeteer';

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
	ignore?: string;
	timeout?: number;
	openDisclosures?: boolean;
	scrollInterval?: number | DelayOptions;
	scrollDistance?: number | DelayOptions;
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

		if (options?.ignore) {
			await page.evaluate((ignore) => {
				const scope = document.body;
				const nodes = scope.querySelectorAll<HTMLElement>(ignore);
				for (const node of nodes) {
					const box = node.getBoundingClientRect();
					const replacement = document.createElement('div');
					replacement.style.position = node.style.position;
					replacement.style.top = node.style.top;
					replacement.style.left = node.style.left;
					replacement.style.right = node.style.right;
					replacement.style.bottom = node.style.bottom;
					replacement.style.zIndex = node.style.zIndex;
					replacement.style.margin = node.style.margin;
					replacement.style.border = node.style.border;
					replacement.style.width = `${box.width}px`;
					replacement.style.height = `${box.height}px`;
					node.replaceWith(replacement);
				}
			}, options?.ignore);
		}

		let binary: Uint8Array | null = null;
		const filePath = options?.path?.replace(/\.png$/i, `@${name}.png`) ?? null;

		if (!options?.domOnly) {
			listener?.('screenshotStart', { name });

			const scope = options?.selector
				? await page.waitForSelector(options.selector)
				: page;
			const fullPage = options?.selector ? false : true;

			if (!scope) {
				throw new Error(`Element not found: ${options?.selector}`);
			}

			try {
				if (filePath && options?.path) {
					listener?.('screenshotSaving', { name, path: options.path });
					await scope.screenshot({
						fullPage,
						type: 'png',
						path: filePath as `${string}.png`,
					});
				} else {
					binary = await getBinary(scope, {
						fullPage,
					});
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

			// Normalize text content for diff accuracy by adding line breaks between block elements
			// This ensures consistent text extraction regardless of HTML formatting
			const lineBreaks = scope.querySelectorAll(
				'div, h1, h2, h3, h4, h5, h6, br, p, li, dt, dd, th, td',
			);
			for (const node of lineBreaks) {
				node.append('\n');
			}

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
