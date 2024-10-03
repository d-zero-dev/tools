import type { FrontMatterResult } from 'front-matter';

import fs from 'node:fs/promises';

import { toList } from '@d-zero/readtext/list';
import fm from 'front-matter';

export async function readConfig(filePath: string) {
	const fileContent = await fs.readFile(filePath, 'utf8');
	const content: FrontMatterResult<{
		hooks?: readonly string[];
	}> =
		// @ts-ignore
		fm(fileContent);

	const urlList = toList(content.body);

	return {
		urlList,
	};
}