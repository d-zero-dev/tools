import type { PageHookSource } from '@d-zero/puppeteer-page-scan';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { delay } from '@d-zero/shared/delay';

import { getData } from './modules/get-data.js';

export type ChildProcessParams = {
	dir: string;
	hooks?: PageHookSource;
};

createChildProcess<ChildProcessParams>(async (param) => {
	const { dir, hooks: hookSource } = param;

	const hooks =
		hookSource && hookSource.paths.length > 0
			? await readPageHooks(hookSource.paths, hookSource.baseDir)
			: undefined;

	return {
		async eachPage({ page, id, url }, logger) {
			const data = await getData(page, url, { hooks }, logger);

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
	};
});
