import type { ChildProcessParams } from './freeze-child-process.js';
import type { FreezeOptions } from './types.js';
import type { DealOptions } from '@d-zero/dealer';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { zip } from '@d-zero/fs/zip';
import { createProcess, deal } from '@d-zero/puppeteer-dealer';
import { timestamp } from '@d-zero/shared/timestamp';
import c from 'ansi-colors';

import { analyzeUrlList } from './modules/analize-url.js';

/**
 *
 * @param list
 * @param options
 */
export async function freeze(
	list: readonly string[],
	options?: FreezeOptions & DealOptions,
) {
	const name = `${timestamp('YYYYMMDD')}.archae`;
	const dir = path.resolve(process.cwd(), `.${name}`);
	await mkdir(dir, { recursive: true }).catch(() => {});

	const urlInfo = analyzeUrlList(list);
	const useOldMode = urlInfo.hasAuth || urlInfo.hasNoSSL;

	await deal(
		list.map((url) => ({ id: null, url })),
		(_, done, total) => {
			return `${c.bold.magenta('🕵️  Archaeologist Freeze❄️')} ${done}/${total}`;
		},
		() => {
			return createProcess<ChildProcessParams>(
				path.resolve(import.meta.dirname, 'freeze-child-process.js'),
				{
					dir,
				},
				{
					...options,
					headless: useOldMode ? 'shell' : true,
				},
			);
		},
		{
			...options,
		},
	);

	const urlListPath = path.resolve(dir, '_URL_LIST.json');
	await writeFile(urlListPath, JSON.stringify(list, null, '\t'), 'utf8');

	const zipPath = path.resolve(process.cwd(), `${name}.zip`);
	await zip(zipPath, dir);

	return zipPath;
}
