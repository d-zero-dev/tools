import type { FreezeOptions } from './types.js';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { zip } from '@d-zero/fs/zip';
import { deal } from '@d-zero/puppeteer-dealer';
import { delay } from '@d-zero/shared/delay';
import { timestamp } from '@d-zero/shared/timestamp';
import c from 'ansi-colors';

import { analyzeUrlList } from './analize-url.js';
import { getData } from './get-data.js';

/**
 *
 * @param list
 * @param options
 */
export async function freeze(list: readonly string[], options?: FreezeOptions) {
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
		{
			async deal(page, id, url, logger) {
				const data = await getData(
					page,
					url,
					{
						...options,
					},
					logger,
				);

				await delay(600);

				for (const size of Object.values(data.screenshots)) {
					const jsonFile = path.resolve(dir, `${id}_${size.id}.html`);
					const ssFile = path.resolve(dir, `${id}_${size.id}.png`);

					await writeFile(jsonFile, size.dom, 'utf8');
					if (size.binary) {
						await writeFile(ssFile, size.binary);
					}
				}
			},
		},
		{
			...options,
			headless: useOldMode ? 'shell' : true,
		},
	);

	const urlListPath = path.resolve(dir, '_URL_LIST.json');
	await writeFile(urlListPath, JSON.stringify(list, null, '\t'), 'utf8');

	const zipPath = path.resolve(process.cwd(), `${name}.zip`);
	await zip(zipPath, dir);

	return zipPath;
}
