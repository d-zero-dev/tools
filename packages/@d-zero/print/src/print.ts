import type { PrintType } from './types.js';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/dealer';
import c from 'ansi-colors';
import puppeteer from 'puppeteer';

import { pngToPdf } from './png-to-pdf.js';
import { printPdf } from './print-pdf.js';
import { printPng } from './print-png.js';

export interface PrintOptions {
	readonly type?: PrintType;
	readonly limit?: number;
	readonly debug?: boolean;
}

export async function print(urlList: readonly string[], options?: PrintOptions) {
	const browser = await puppeteer.launch({
		headless: true,
		args: [
			//
			'--lang=ja',
			'--no-zygote',
			'--ignore-certificate-errors',
		],
	});

	const dir = path.resolve(process.cwd(), '.print');
	await mkdir(dir, { recursive: true }).catch(() => {});

	const type = options?.type ?? 'png';

	await deal(
		urlList.map((url) => ({ url })),
		({ url }, update, index) => {
			return async () => {
				update(`%braille% Open: ${url}`);
				const page = await browser.newPage();
				page.setDefaultNavigationTimeout(0);
				await page.setExtraHTTPHeaders({
					'Accept-Language': 'ja-JP',
				});

				const fileId = index.toString().padStart(3, '0');
				const ext = type === 'pdf' ? 'pdf' : 'png';
				const fileName = `${fileId}.${ext}`;
				const filePath = path.resolve(dir, fileName);

				const lineHeader = `%braille% ${c.gray(url)}: `;

				if (type === 'pdf') {
					await printPdf(page, url, filePath, (log) => update(lineHeader + log));
					update(`${lineHeader}🔚 Closing`);
					await page.close();
					return;
				}

				const result = await printPng(page, url, fileId, filePath, (log) =>
					update(lineHeader + log),
				);

				if (type === 'png') {
					update(`${lineHeader}🔚 Closing`);
					await page.close();
					return;
				}

				await pngToPdf(browser, result, (log) => update(lineHeader + log));
				update(`${lineHeader}🔚 Closing`);
				await page.close();
			};
		},
		{
			limit: options?.limit,
			debug: options?.debug,
			header(_, done, total) {
				return `${c.bold.magenta('🎨 Print pages')} ${c.bgBlueBright(` ${type} `)} ${done}/${total}`;
			},
		},
	);

	await browser.close();
}
