import type { Page } from '@d-zero/puppeteer-page';
import type { Screenshot } from '@d-zero/puppeteer-screenshot';

import dayjs from 'dayjs';

export async function printPdfWithNote(
	page: Page,
	{ id, filePath, url, title }: Screenshot,
) {
	if (!filePath) {
		throw new Error(`No file path (ID: ${id}): ${url}`);
	}

	const datetime = dayjs().format('YYYY-MM-DD HH:mm');

	await page.evaluate(() => {
		const style = document.createElement('style');
		style.textContent = `
				html, body { height: auto !important; }
				html, body { margin: 0; padding: 0; }
				img { width: 100% !important; height: auto !important; }
			`;
		document.body.setAttribute('style', 'margin: 0; padding: 0;');
		document.head.append(style);
	});

	await page.pdf({
		path: filePath,
		timeout: 30_000 * 10, // Default * 10
		format: 'A4',
		printBackground: true,
		displayHeaderFooter: true,
		margin: { top: '1.3cm', bottom: '1cm', left: '1cm', right: '5cm' },
		headerTemplate: `
				<div style="font-size: 2mm; width: 100%; display: flex; justify-content: space-between; margin: 0 1cm; font-family: sans-serif;">
					<div>
						<div>Title: ${title}</div>
						<div style="font-size: 0.6em">Printed: ${datetime}</div>
					</div>
					<div>
						<div style="font-size: 3mm; margin-bottom: 1mm; text-align: right;">[ID: ${id}]</div>
						<div style="text-align: right; background-color: #000; color: #fff;">Note:</div>
					</div>
				</div>
			`,
		footerTemplate: `
				<div style="font-size: 2mm; width: 100%; display: flex; justify-content: space-between; margin: 0 1cm; font-family: monospace;">
					<div>
						<span>[ID: ${id}] ${url}</span>
					</div>
					<div>
						<span class="pageNumber"></span>/<span class="totalPages"></span>
					</div>
				</div>
			`,
	});
}
