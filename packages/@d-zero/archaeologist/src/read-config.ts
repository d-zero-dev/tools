import type { FrontMatterResult } from 'front-matter';

import fs from 'node:fs/promises';
import path from 'node:path';

import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { toList } from '@d-zero/readtext/list';
import fm from 'front-matter';

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

	const baseDir = path.dirname(filePath);
	const hooks = await readPageHooks(content.attributes?.hooks ?? [], baseDir);

	return {
		pairList,
		hooks,
	};
}
