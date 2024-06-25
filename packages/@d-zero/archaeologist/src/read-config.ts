import type { FrontMatterResult } from 'front-matter';

import fs from 'node:fs/promises';

import { toList } from '@d-zero/readtext/list';
import fm from 'front-matter';

import { readHooks } from './read-hooks.js';

export async function readConfig(filePath: string) {
	const fileContent = await fs.readFile(filePath, 'utf8');
	const content: FrontMatterResult<{
		comparisonHost: string;
		hooks?: readonly string[];
	}> =
		// @ts-ignore
		fm(fileContent);

	const urlList = toList(content.body);

	const pairList: [string, string][] = urlList.map((urlStr) => {
		const url = new URL(urlStr);
		return [
			url.toString(),
			`${content.attributes.comparisonHost}${url.pathname}${url.search}`,
		];
	});

	const hooks = await readHooks(content.attributes?.hooks ?? [], filePath);

	return {
		pairList,
		hooks,
	};
}
