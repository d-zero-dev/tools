import type { DiffImagesPhase } from './diff-images.js';
import type { PageData, Result, URLPair } from './types.js';
import type { Phase } from '@d-zero/puppeteer-screenshot';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/dealer';
import c from 'ansi-colors';
import puppeteer from 'puppeteer';

import { analyzeUrlList } from './analize-url.js';
import { diffImages } from './diff-images.js';
import { diffTree } from './diff-tree.js';
import { getData } from './get-data.js';
import { label, score } from './output-utils.js';

export async function analyze(list: readonly URLPair[]): Promise<Result[]> {
	const urlInfo = analyzeUrlList(list);
	const useOldMode = urlInfo.hasAuth && urlInfo.hasNoSSL;

	const browser = await puppeteer.launch({
		headless: useOldMode ? 'shell' : true,
		args: [
			//
			'--lang=ja',
			'--no-zygote',
			'--ignore-certificate-errors',
		],
	});

	const results: Result[] = [];

	const dir = path.resolve(process.cwd(), '.archaeologist');
	await mkdir(dir, { recursive: true }).catch(() => {});

	await deal(
		list,
		//
		async (urlPair, update, index) => {
			const page = await browser.newPage();
			page.setDefaultNavigationTimeout(0);
			await page.setUserAgent(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
			);
			await page.setExtraHTTPHeaders({
				'Accept-Language': 'ja-JP',
			});

			return async () => {
				const dataPair: PageData[] = [];
				for (const url of urlPair) {
					const data = await getData(page, url, (phase, data) => {
						const outputUrl = c.gray(url);
						const sizeName = label(data.name);
						switch (phase) {
							case 'setViewport': {
								const { width } = data as Phase['setViewport'];
								update(
									`%braille% ${outputUrl} ${sizeName}: ↔️ Change viewport size to ${width}px`,
								);
								break;
							}
							case 'load': {
								const { type } = data as Phase['load'];
								update(
									`%braille% ${outputUrl} ${sizeName}: %earth% ${type === 'open' ? 'Open' : 'Reload'} page`,
								);
								break;
							}
							case 'scroll': {
								update(`%braille% ${outputUrl} ${sizeName}: %propeller% Scroll the page`);
								break;
							}
							case 'screenshotStart': {
								update(`%braille% ${outputUrl} ${sizeName}: 📸 Take a screenshot`);
								break;
							}
							case 'screenshotEnd': {
								const { binary } = data as Phase['screenshotEnd'];
								update(
									`%braille% ${outputUrl} ${sizeName}: 📸 Screenshot taken (${binary.length} bytes)`,
								);
								break;
							}
						}
					});

					dataPair.push(data);

					await delay(600);
				}

				const [a, b] = dataPair;

				if (!a || !b) {
					throw new Error('Failed to get screenshots');
				}

				const screenshotResult: Record<
					string,
					{
						matches: number;
						file: string;
					}
				> = {};

				const outputUrl = c.gray(urlPair.join(' vs '));

				for (const [name, screenshotA] of Object.entries(a.screenshots)) {
					const screenshotB = b.screenshots[name];
					const sizeName = label(name);

					const id = `${index}_${name}`;
					if (!screenshotB) {
						throw new Error(`Failed to get screenshotB: ${id}`);
					}

					const imageDiff = await diffImages(screenshotA, screenshotB, (phase, data) => {
						switch (phase) {
							case 'create': {
								update(`%braille% ${outputUrl} ${sizeName}: 🖼️ Create images`);
								break;
							}
							case 'resize': {
								const { width, height } = data as DiffImagesPhase['resize'];
								update(
									`%braille% ${outputUrl} ${sizeName}: ↔️ Resize images to ${width}x${height}`,
								);
								break;
							}
							case 'diff': {
								update(`%braille% ${outputUrl} ${sizeName}: 📊 Compare images`);
								break;
							}
						}
					});

					update(
						`%braille% ${outputUrl} ${sizeName}: 🧩 Matches ${score(imageDiff.matches, 0.9)}`,
					);
					await delay(1500);

					await writeFile(path.resolve(dir, `${id}_a.png`), imageDiff.images.a);
					await writeFile(path.resolve(dir, `${id}_b.png`), imageDiff.images.b);

					const outFilePath = path.resolve(dir, `${id}_diff.png`);
					update(
						`%braille% ${outputUrl} ${sizeName}: 📊 Save diff image to ${path.relative(dir, outFilePath)}`,
					);
					await writeFile(outFilePath, imageDiff.images.diff);

					screenshotResult[name] = {
						matches: imageDiff.matches,
						file: outFilePath,
					};
				}

				const htmlDiff = diffTree(a.serializedHtml, b.serializedHtml);
				const outFilePath = path.resolve(dir, `${index}_html.diff`);
				await writeFile(outFilePath, htmlDiff.result, { encoding: 'utf8' });

				const result: Result = {
					target: [a.url, b.url],
					screenshots: screenshotResult,
					html: {
						matches: htmlDiff.matches,
						diff: htmlDiff.changed ? htmlDiff.result : null,
						file: outFilePath,
					},
				};

				results.push(result);
			};
		},
		{
			header(_, done, total) {
				return `${c.bold.magenta('🕵️  Archaeologist')} ${done}/${total}`;
			},
		},
	);

	await browser.close();

	return results;
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
