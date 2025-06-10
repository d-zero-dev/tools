import type { FrontMatterResult } from 'front-matter';

import fs from 'node:fs/promises';
import path from 'node:path';

import fm from 'front-matter';

/**
 * Common configuration file reader with front-matter support
 * @param filePath
 */
export async function readConfigFile<T = unknown>(
	filePath: string,
): Promise<{
	content: FrontMatterResult<T>;
	baseDir: string;
}> {
	const fileContent = await fs.readFile(filePath, 'utf8');
	// @ts-ignore
	const content: FrontMatterResult<T> = fm(fileContent);
	const baseDir = path.dirname(filePath);

	return {
		content,
		baseDir,
	};
}
