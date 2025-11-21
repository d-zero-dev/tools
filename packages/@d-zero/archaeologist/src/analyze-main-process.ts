import type { ChildProcessParams } from './analyze-child-process.js';
import type { AnalyzeOptions, Result, URLPair } from './types.js';
import type { DealOptions } from '@d-zero/dealer';

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createProcess, deal } from '@d-zero/puppeteer-dealer';
import c from 'ansi-colors';
import stripAnsi from 'strip-ansi';

import { analyzeUrlList } from './modules/analize-url.js';
import { score } from './utils.js';

/**
 *
 * @param list
 * @param options
 */
export async function analyze(
	list: readonly URLPair[],
	options?: AnalyzeOptions & DealOptions,
) {
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
		() => {
			return createProcess<ChildProcessParams, Result>(
				path.resolve(import.meta.dirname, 'analyze-child-process.js'),
				{
					list,
					dir,
					useOldMode,
					types: options?.types,
					selector: options?.selector,
					ignore: options?.ignore,
					devices: options?.devices,
					hooks: options?.hooks ?? [],
					combined: options?.combined,
				},
				{
					...options,
					headless: useOldMode ? 'shell' : true,
				},
			);
		},
		{
			...options,
			each(result) {
				results.push(result);
			},
		},
	);

	const output: string[] = [];

	for (const result of results) {
		output.push(c.gray(`${result.target.join(' vs ')}`));
		for (const [sizeName, { image, dom, text }] of Object.entries(result.screenshots)) {
			if (image) {
				const { matches, file } = image;
				output.push(`  ${c.bgMagenta(` ${sizeName} `)} ${score(matches, 0.9)} ${file}`);
			}
			if (dom) {
				output.push(
					`  ${c.bgBlueBright(' HTML ')}: ${score(dom.matches, 0.995)} ${dom.file}`,
				);
			}
			if (text) {
				output.push(
					`  ${c.bgGreenBright(' TEXT ')}: ${score(text.matches, 0.995)} ${text.file}`,
				);
			}
		}
	}

	await writeFile(
		path.resolve(dir, 'RESULT.txt'),
		stripAnsi(output.join('\n').replaceAll(dir, '.')),
		'utf8',
	);

	process.stdout.write(output.join('\n') + '\n');
}
