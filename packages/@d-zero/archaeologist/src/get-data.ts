import type { PageData } from './types.js';
import type { Listener } from '@d-zero/puppeteer-screenshot';
import type { Page } from 'puppeteer';

import { distill } from '@d-zero/html-distiller';
import { screenshot } from '@d-zero/puppeteer-screenshot';

export async function getData(
	page: Page,
	url: string,
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
		listener,
	});

	const html = await page.content();
	const serializedHtmlTree = distill(html).tree;
	const serializedHtml = JSON.stringify(serializedHtmlTree, null, 2);

	return {
		url,
		serializedHtml,
		screenshots,
	};
}
