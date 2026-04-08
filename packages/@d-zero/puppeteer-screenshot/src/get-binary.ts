import type { ElementHandle, Page, ScreenshotOptions } from 'puppeteer';

/**
 *
 * @param scope
 * @param options
 */
export async function getBinary(
	scope: Page | ElementHandle<Element>,
	options?: Readonly<ScreenshotOptions>,
) {
	const buffer = await scope.screenshot({
		...options,
		type: 'png',
		encoding: 'binary',
	});
	return buffer;
}
