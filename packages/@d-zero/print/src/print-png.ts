import type { PageHook } from '@d-zero/puppeteer-screenshot';
import type { Page } from 'puppeteer';

import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

export function printPng(
	page: Page,
	url: string,
	fileId: string,
	filePath: string,
	update: (log: string) => void,
	hooks?: readonly PageHook[],
) {
	return screenshot(page, url, {
		id: fileId,
		path: filePath,
		sizes: {
			desktop: {
				width: 1280,
			},
			mobile: {
				width: 375,
				resolution: 2,
			},
		},
		listener: screenshotListener(update),
		hooks,
	});
}
