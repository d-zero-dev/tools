import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { toKvList } from '@d-zero/readtext/list';
import { readConfigFile } from '@d-zero/shared/config-reader';

/**
 *
 * @param filePath
 */
export async function readConfig(filePath: string) {
	const { content, baseDir } = await readConfigFile<{
		hooks?: readonly string[];
	}>(filePath);

	const urlList = toKvList(content.body).map((kv) => ({
		id: kv.value ? kv.key : null,
		url: kv.value || kv.key,
	}));

	const hooks = await readPageHooks(content.attributes?.hooks ?? [], baseDir);

	return {
		urlList,
		hooks,
	};
}
