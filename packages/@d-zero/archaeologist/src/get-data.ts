import type { PageData } from './types.js';
import type { Listener, PageHook } from '@d-zero/puppeteer-screenshot';
import type { Page } from 'puppeteer';

import { distill } from '@d-zero/html-distiller';
import { screenshot } from '@d-zero/puppeteer-screenshot';

export interface GetDataOptions {
	readonly hooks?: readonly PageHook[];
}

export async function getData(
	page: Page,
	url: string,
	options: GetDataOptions,
	listener: Listener,
): Promise<PageData> {
	const screenshots = await screenshot(page, url, {
		sizes: {
			desktop: {
				width: 1280,
			},
			mobile: {
				width: 375,
				resolution: 2,
			},
		},
		hooks: options?.hooks ?? [],
		listener,
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
