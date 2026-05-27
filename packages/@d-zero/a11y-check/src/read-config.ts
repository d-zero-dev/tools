import type { PageHookSource } from '@d-zero/puppeteer-page-scan';

import { toKvList } from '@d-zero/readtext/list';
import { readConfigFile } from '@d-zero/shared/config-reader';

/**
 *
 * @param filePath
 */
export async function readConfig(filePath: string): Promise<{
	urlList: { id: string | null; url: string }[];
	hooks: PageHookSource;
}> {
	const { content, baseDir } = await readConfigFile<{
		hooks?: readonly string[];
	}>(filePath);

	const urlList = toKvList(content.body).map((kv) => ({
		id: kv.value ? kv.key : null,
		url: kv.value || kv.key,
	}));

	return {
		urlList,
		hooks: {
			paths: content.attributes?.hooks ?? [],
			baseDir,
		},
	};
}
