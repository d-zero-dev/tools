import type { Phase } from '@d-zero/puppeteer-screenshot';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/dealer';
import { screenshot } from '@d-zero/puppeteer-screenshot';
import c from 'ansi-colors';
import puppeteer from 'puppeteer';

import { label } from './label.js';

export interface PrintOptions {
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

	await deal(
		urlList.map((url) => ({ url })),
		//
		({ url }, update, index) => {
			return async () => {
				update(`%braille% Open: ${url}`);
				const page = await browser.newPage();
				page.setDefaultNavigationTimeout(0);
				await page.setExtraHTTPHeaders({
					'Accept-Language': 'ja-JP',
				});

				const fileId = index.toString().padStart(3, '0');

				const outputUrl = c.gray(url);

				await screenshot(page, url, {
					id: fileId,
					sizes: {
						desktop: {
							width: 1280,
						},
						mobile: {
							width: 375,
							resolution: 2,
						},
					},
					listener(phase, data) {
						const sizeName = label(data.name);

						const fixedOutput = `%braille% ${outputUrl} ${sizeName}`;

						switch (phase) {
							case 'setViewport': {
								const { width } = data as Phase['setViewport'];
								update(`${fixedOutput}: ↔️ Change viewport size to ${width}px`);
								break;
							}
							case 'load': {
								const { type } = data as Phase['load'];
								update(
									`${fixedOutput}: %earth% ${type === 'open' ? 'Open' : 'Reload'} page`,
								);
								break;
							}
							case 'hook': {
								const { message } = data as Phase['hook'];
								update(`${fixedOutput}: ${message}`);
								break;
							}
							case 'scroll': {
								update(`${fixedOutput}: %propeller% Scroll the page`);
								break;
							}
							case 'screenshotStart': {
								update(`${fixedOutput}: 📸 Take a screenshot`);
								break;
							}
							case 'screenshotSaving': {
								const { path: filePath } = data as Phase['screenshotSaving'];
								const name = path.basename(filePath);
								update(`${fixedOutput}: 🖼  Save a file ${name}`);
								break;
							}
							case 'screenshotError': {
								const { error } = data as Phase['screenshotError'];
								update(`${fixedOutput}: ❌️ ${error.message}`);
								break;
							}
						}
					},
				});

				update(`%braille% ${outputUrl}: 🔚 Closing`);
				await page.close();
			};
		},
		{
			limit: options?.limit,
			debug: options?.debug,
			header(_, done, total) {
				return `${c.bold.magenta('🎨 Print pages')} ${done}/${total}`;
			},
		},
	);

	await browser.close();
}
