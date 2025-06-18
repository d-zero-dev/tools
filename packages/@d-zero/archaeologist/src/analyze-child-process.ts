import type { DiffImagesPhase } from './modules/diff-images.js';
import type {
	DOMResult,
	ImageResult,
	MediaResult,
	PageData,
	Result,
	TextResult,
	URLPair,
} from './types.js';
import type { PageHook } from '@d-zero/puppeteer-page-scan';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { delay } from '@d-zero/shared/delay';
import c from 'ansi-colors';

import { diffImages } from './modules/diff-images.js';
import { diffText } from './modules/diff-text.js';
import { diffTree } from './modules/diff-tree.js';
import { getData } from './modules/get-data.js';
import { normalizeTextDocument } from './modules/normalize-text-document.js';
import { score } from './utils.js';

export type ChildProcessParams = {
	list: readonly URLPair[];
	dir: string;
	useOldMode: boolean;
	types?: readonly string[];
	selector?: string;
	ignore?: string;
	devices?: readonly string[];
	hooks?: readonly PageHook[];
};

createChildProcess<ChildProcessParams, Result>((param) => {
	const {
		list,
		dir,
		types = ['image', 'dom', 'text'],
		selector,
		ignore,
		devices,
	} = param;

	return {
		async eachPage({ page, url: urlA, index }, logger) {
			const urlPair = list.find(([url]) => url === urlA);

			if (!urlPair) {
				throw new Error(`Failed to find urlPair: ${urlA}`);
			}

			const dataPair: PageData[] = [];

			for (const url of urlPair) {
				const data = await getData(
					page,
					url,
					{
						htmlDiffOnly: !types.includes('image'),
						selector,
						ignore,
						devices,
					},
					logger,
				);

				dataPair.push(data);

				await delay(600);
			}

			const [a, b] = dataPair;

			if (!a || !b) {
				throw new Error('Failed to get screenshots');
			}

			const screenshotResult: Record<string, MediaResult> = {};

			const outputUrl = 'vs ' + c.gray(urlPair[1]);

			for (const [name, screenshotA] of Object.entries(a.screenshots)) {
				const screenshotB = b.screenshots[name];
				const sizeName = c.bgMagenta(` ${name} `);
				const id = `${index}_${name}`;

				if (!screenshotB) {
					throw new Error(`Failed to get screenshotB: ${id}`);
				}

				let image: ImageResult | null = null;

				if (types.includes('image')) {
					const imageDiff = await diffImages(screenshotA, screenshotB, (phase, data) => {
						switch (phase) {
							case 'create': {
								logger(`${sizeName} ${outputUrl} 🖼️ Create images`);
								break;
							}
							case 'resize': {
								const { width, height } = data as DiffImagesPhase['resize'];
								logger(`${sizeName} ${outputUrl} ↔️ Resize images to ${width}x${height}`);
								break;
							}
							case 'diff': {
								logger(`${sizeName} ${outputUrl} 📊 Compare images`);
								break;
							}
						}
					});

					if (imageDiff) {
						logger(
							`${sizeName} ${outputUrl} 🧩 Matches ${score(imageDiff.matches, 0.9)}`,
						);
						await delay(1500);

						await writeFile(path.resolve(dir, `${id}_a.png`), imageDiff.images.a);
						await writeFile(path.resolve(dir, `${id}_b.png`), imageDiff.images.b);

						const outFilePath = path.resolve(dir, `${id}_diff.png`);
						logger(
							`${sizeName} ${outputUrl} 📊 Save diff image to ${path.relative(dir, outFilePath)}`,
						);
						await writeFile(outFilePath, imageDiff.images.diff);

						image = {
							matches: imageDiff.matches,
							file: outFilePath,
						};
					}
				}

				let dom: DOMResult | null = null;

				if (types.includes('dom')) {
					const htmlDiff = diffTree(
						a.url,
						b.url,
						screenshotA.domTree,
						screenshotB.domTree,
					);
					const outFilePath = path.resolve(dir, `${id}_html.diff`);
					await writeFile(outFilePath, htmlDiff.result, { encoding: 'utf8' });

					dom = {
						matches: htmlDiff.matches,
						diff: htmlDiff.changed ? htmlDiff.result : null,
						file: outFilePath,
					};
				}

				let text: TextResult | null = null;

				if (types.includes('text')) {
					const contentA = normalizeTextDocument(screenshotA.text.textContent);
					const contentB = normalizeTextDocument(screenshotB.text.textContent);
					const altTextListA = screenshotA.text.altTextList.join('\n');
					const altTextListB = screenshotB.text.altTextList.join('\n');
					const textA = `${contentA}\n\n${altTextListA}`;
					const textB = `${contentB}\n\n${altTextListB}`;
					const textDiff = diffText(a.url, b.url, textA, textB);
					const outFilePath = path.resolve(dir, `${id}_text.diff`);
					await writeFile(
						outFilePath,
						`${textDiff.phrases.result}\n\n${textDiff.tokens.result}`,
						{ encoding: 'utf8' },
					);

					text = {
						matches: textDiff.tokens.matches,
						diff: textDiff.tokens.changed ? textDiff.tokens.result : null,
						file: outFilePath,
					};
				}

				screenshotResult[name] = {
					image,
					dom,
					text,
				};
			}

			const result: Result = {
				target: [a.url, b.url],
				screenshots: screenshotResult,
			};

			return result;
		},
	};
});
