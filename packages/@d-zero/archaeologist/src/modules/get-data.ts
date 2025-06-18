import type { PageData } from '../types.js';
import type { Sizes } from '@d-zero/puppeteer-page-scan';
import type { PageHook } from '@d-zero/puppeteer-screenshot';
import type { Page } from 'puppeteer';

import { distill } from '@d-zero/html-distiller';
import { defaultSizes } from '@d-zero/puppeteer-page-scan';
import { screenshotListener, screenshot } from '@d-zero/puppeteer-screenshot';

export interface GetDataOptions {
	readonly hooks?: readonly PageHook[];
	readonly htmlDiffOnly?: boolean;
	readonly selector?: string;
	readonly ignore?: string;
	readonly devices?: readonly string[];
}

/**
 *
 * @param page
 * @param url
 * @param options
 * @param update
 */
export async function getData(
	page: Page,
	url: string,
	options: GetDataOptions,
	update: (log: string) => void,
): Promise<PageData> {
	const htmlDiffOnly = options.htmlDiffOnly ?? false;

	const devices = options.devices ?? ['desktop', 'mobile'];
	const sizes: Sizes = {};
	for (const device of devices) {
		// @ts-ignore
		sizes[device] = defaultSizes[device];
	}

	const screenshots = await screenshot(page, url, {
		sizes,
		hooks: options?.hooks ?? [],
		listener: screenshotListener(update),
		domOnly: htmlDiffOnly,
		selector: options.selector,
		ignore: options.ignore,
	});

	const data: PageData = { url, screenshots: {} };

	for (const [sizeName, screenshot] of Object.entries(screenshots)) {
		data.screenshots[sizeName] = {
			...screenshot,
			domTree: JSON.stringify(distill(screenshot.dom).tree, null, 2),
		};
	}

	return data;
}
