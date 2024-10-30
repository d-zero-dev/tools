import type { Page } from '@d-zero/puppeteer-page';
import type { PageHook } from '@d-zero/puppeteer-page-scan';

import { beforePageScan, pageScanListener } from '@d-zero/puppeteer-page-scan';

export async function printPdf(
	page: Page,
	url: string,
	filePath: string,
	update: (log: string) => void,
	hooks?: readonly PageHook[],
) {
	await beforePageScan(page, url, {
		name: 'pdf',
		width: 1400,
		listener: pageScanListener(update),
		hooks,
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
