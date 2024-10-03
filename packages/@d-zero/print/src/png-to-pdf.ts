import type { Screenshot } from '@d-zero/puppeteer-screenshot';
import type { Browser } from 'puppeteer';

import { rm } from 'node:fs/promises';
import path from 'node:path';

import c from 'ansi-colors';

import { printPdfWithNote } from './print-pdf-with-note.js';

export async function pngToPdf(
	browser: Browser,
	screenshots: Record<string, Screenshot>,
	update: (log: string) => void,
) {
	const page = await browser.newPage();
	page.setDefaultNavigationTimeout(0);

	for (const [sizeName, screenshot] of Object.entries(screenshots)) {
		if (!screenshot.filePath) {
			continue;
		}
		const sizeLabel = c.bgMagenta(` ${sizeName} `);

		update(`🖼  Open an image file`);

		await page.goto(`file://${screenshot.filePath}`, {
			waitUntil: 'networkidle0',
			timeout: 5 * 60 * 1000,
		});

		const dir = path.dirname(screenshot.filePath);
		const fileName = path.basename(
			screenshot.filePath,
			path.extname(screenshot.filePath),
		);
		const pdfPath = path.resolve(dir, `${fileName}.pdf`);

		update(`${sizeLabel} 📝 Print as a PDF%dots%`);

		await printPdfWithNote(page, { ...screenshot, filePath: pdfPath });

		update(`${sizeLabel} 🚮 Remove the screenshot image`);

		await rm(screenshot.filePath);
	}
}
