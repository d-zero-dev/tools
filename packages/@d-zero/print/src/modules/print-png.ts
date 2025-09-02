import type { Sizes } from '@d-zero/puppeteer-page-scan';
import type { PageHook } from '@d-zero/puppeteer-screenshot';
import type { Page } from 'puppeteer';

import { devicePresets } from '@d-zero/puppeteer-page-scan';
import { screenshot, screenshotListener } from '@d-zero/puppeteer-screenshot';

/**
 *
 * @param page
 * @param url
 * @param fileId
 * @param filePath
 * @param update
 * @param hooks
 * @param devices
 * @param timeout
 */
export function printPng(
	page: Page,
	url: string,
	fileId: string,
	filePath: string,
	update: (log: string) => void,
	hooks?: readonly PageHook[],
	devices?: Sizes,
	timeout?: number,
) {
	const defaultSizes = {
		'desktop-compact': devicePresets['desktop-compact'],
		mobile: devicePresets.mobile,
	};

	return screenshot(page, url, {
		id: fileId,
		path: filePath,
		sizes: devices ?? defaultSizes,
		listener: screenshotListener(update),
		hooks,
		timeout,
	});
}
