import type { DiffImagesPhase } from './diff-images.js';
import type {
	AnalyzeOptions,
	ImageResult,
	MediaResult,
	PageData,
	Result,
	URLPair,
} from './types.js';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/puppeteer-dealer';
import { delay } from '@d-zero/shared/delay';
import c from 'ansi-colors';

import { analyzeUrlList } from './analize-url.js';
import { diffImages } from './diff-images.js';
import { diffTree } from './diff-tree.js';
import { getData } from './get-data.js';
import { score } from './output-utils.js';

/**
 *
 * @param list
 * @param options
 */
export async function analyze(
	list: readonly URLPair[],
	options?: AnalyzeOptions,
): Promise<Result[]> {
	const results: Result[] = [];

	const dir = path.resolve(process.cwd(), '.archaeologist');
	await mkdir(dir, { recursive: true }).catch(() => {});

	const urlInfo = analyzeUrlList(list);
	const useOldMode = urlInfo.hasAuth || urlInfo.hasNoSSL;

	await deal(
		list.map(([urlA]) => ({ id: null, url: urlA })),
		(_, done, total) => {
			return `${c.bold.magenta('🕵️  Archaeologist')} ${done}/${total}`;
		},
		{
			async deal(page, _, urlA, logger, index) {
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
							...options,
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

					let image: ImageResult | null = null;

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

					const htmlDiff = diffTree(
						a.url,
						b.url,
						screenshotA.domTree,
						screenshotB.domTree,
					);
					const outFilePath = path.resolve(dir, `${id}_html.diff`);
					await writeFile(outFilePath, htmlDiff.result, { encoding: 'utf8' });

					screenshotResult[name] = {
						image,
						dom: {
							matches: htmlDiff.matches,
							diff: htmlDiff.changed ? htmlDiff.result : null,
							file: outFilePath,
						},
					};
				}

				const result: Result = {
					target: [a.url, b.url],
					screenshots: screenshotResult,
				};

				results.push(result);
			},
		},
		{
			...options,
			headless: useOldMode ? 'shell' : true,
		},
	);

	return results;
}
