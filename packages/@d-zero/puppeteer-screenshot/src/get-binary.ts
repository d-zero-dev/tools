import type { Page } from 'puppeteer';

export async function getBinary(page: Page) {
	const buffer = await page.screenshot({
		fullPage: true,
		type: 'png',
		encoding: 'binary',
	});
	return buffer;
}
