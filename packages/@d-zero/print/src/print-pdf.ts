import type { Page } from 'puppeteer';

import { beforePageScan } from '@d-zero/puppeteer-page-scan';
import { screenshotListener } from '@d-zero/puppeteer-screenshot';

export async function printPdf(
	page: Page,
	url: string,
	filePath: string,
	update: (log: string) => void,
) {
	await beforePageScan(page, url, {
		name: 'pdf',
		width: 1400,
		listener: screenshotListener(update),
	});

	update('📄 Save as PDF');

	await page.pdf({
		path: filePath,
		timeout: 30_000 * 10,
		format: 'A4',
		printBackground: true,
		displayHeaderFooter: false,
	});
}
