import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import { delay } from '@d-zero/shared/delay';

import { getData } from './modules/get-data.js';

export type ChildProcessParams = {
	dir: string;
};

createChildProcess<ChildProcessParams>((param) => {
	const { dir } = param;

	return {
		async eachPage({ page, id, url }, logger) {
			const data = await getData(page, url, {}, logger);

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
