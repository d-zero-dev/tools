import type { PrintType } from './types.js';
import type { PageHook } from '@d-zero/puppeteer-page-scan';

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
	readonly hooks?: readonly PageHook[];
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
	const hooks = options?.hooks;

	await deal(
		urlList.map((url) => ({ url })),
		({ url }, update, index) => {
			return async () => {
				const page = await browser.newPage();
				page.setDefaultNavigationTimeout(0);
				await page.setExtraHTTPHeaders({
					'Accept-Language': 'ja-JP',
				});

				const fileId = index.toString().padStart(3, '0');
				const ext = type === 'pdf' ? 'pdf' : 'png';
				const fileName = `${fileId}.${ext}`;
				const filePath = path.resolve(dir, fileName);

				const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(url)}: `;

				update(`${lineHeader}🔗 Open%dots%`);

				if (type === 'pdf') {
					await printPdf(page, url, filePath, (log) => update(lineHeader + log), hooks);
					update(`${lineHeader}🔚 Closing`);
					await page.close();
					return;
				}

				const result = await printPng(
					page,
					url,
					fileId,
					filePath,
					(log) => update(lineHeader + log),
					hooks,
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
