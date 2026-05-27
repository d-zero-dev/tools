import type { DiffImagesPhase } from './modules/diff-images.js';
import type {
	CodeResult,
	DOMResult,
	ImageResult,
	MediaResult,
	PageData,
	Result,
	TextResult,
	URLPair,
} from './types.js';
import type { PageHookSource } from '@d-zero/puppeteer-page-scan';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { delay } from '@d-zero/shared/delay';
import c from 'ansi-colors';

import { combineImages } from './modules/combine-images.js';
import { diffImages } from './modules/diff-images.js';
import { diffText } from './modules/diff-text.js';
import { diffTree } from './modules/diff-tree.js';
import { fetchHtml } from './modules/fetch-html.js';
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
	hooks?: PageHookSource;
	combined?: boolean;
};

createChildProcess<ChildProcessParams, Result>(async (param) => {
	const {
		list,
		dir,
		types = ['image', 'dom', 'text', 'code'],
		selector,
		ignore,
		devices,
		hooks: hookSource,
		combined = false,
	} = param;

	const hooks =
		hookSource && hookSource.paths.length > 0
			? await readPageHooks(hookSource.paths, hookSource.baseDir)
			: undefined;

	return {
		async eachPage({ page, url: urlA, index }, logger) {
			const urlPair = list.find(([url]) => url === urlA);

			if (!urlPair) {
				throw new Error(`Failed to find urlPair: ${urlA}`);
			}

			const needsBrowser = types.some((t) => ['image', 'dom', 'text'].includes(t));

			const screenshotResult: Record<string, MediaResult> = {};

			if (needsBrowser) {
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
							hooks,
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
						const imageDiff = await diffImages(
							screenshotA,
							screenshotB,
							(phase, data) => {
								switch (phase) {
									case 'create': {
										logger(`${sizeName} ${outputUrl} 🖼️ Create images`);
										break;
									}
									case 'resize': {
										const { width, height } = data as DiffImagesPhase['resize'];
										logger(
											`${sizeName} ${outputUrl} ↔️ Resize images to ${width}x${height}`,
										);
										break;
									}
									case 'diff': {
										logger(`${sizeName} ${outputUrl} 📊 Compare images`);
										break;
									}
								}
							},
						);

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

							// 合成画像を出力
							if (combined) {
								const combinedImage = await combineImages(
									imageDiff.images.a,
									imageDiff.images.b,
								);
								const combinedFilePath = path.resolve(dir, `${id}_combined.png`);
								logger(
									`${sizeName} ${outputUrl} 🖼️ Save combined image to ${path.relative(dir, combinedFilePath)}`,
								);
								await writeFile(combinedFilePath, combinedImage);
							}

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
			}

			let code: CodeResult | null = null;

			if (types.includes('code')) {
				const fetched = await Promise.all([
					fetchHtml(urlPair[0]),
					fetchHtml(urlPair[1]),
				]).catch((error: unknown) => {
					logger(
						`⚠️ CODE fetch failed: ${error instanceof Error ? error.message : error}`,
					);
					return null;
				});

				if (fetched) {
					const [htmlA, htmlB] = fetched;
					const codeDiff = diffTree(urlPair[0], urlPair[1], htmlA, htmlB);
					const outFilePath = path.resolve(dir, `${index}_code.diff`);
					await writeFile(outFilePath, codeDiff.result, { encoding: 'utf8' });

					code = {
						matches: codeDiff.matches,
						diff: codeDiff.changed ? codeDiff.result : null,
						file: outFilePath,
					};
				}
			}

			const result: Result = {
				target: [...urlPair],
				screenshots: screenshotResult,
				code,
			};

			return result;
		},
	};
});
