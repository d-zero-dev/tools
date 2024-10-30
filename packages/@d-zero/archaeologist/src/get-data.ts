import type { PageData } from './types.js';
import type { Page } from '@d-zero/puppeteer-page';
import type { PageHook } from '@d-zero/puppeteer-screenshot';

import { distill } from '@d-zero/html-distiller';
import { screenshotListener, screenshot } from '@d-zero/puppeteer-screenshot';

export interface GetDataOptions {
	readonly hooks?: readonly PageHook[];
	readonly htmlDiffOnly?: boolean;
}

export async function getData(
	page: Page,
	url: string,
	options: GetDataOptions,
	update: (log: string) => void,
): Promise<PageData> {
	const htmlDiffOnly = options.htmlDiffOnly ?? false;

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
		listener: screenshotListener(update),
		domOnly: htmlDiffOnly,
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
