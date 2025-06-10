import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { toList } from '@d-zero/readtext/list';
import { readConfigFile } from '@d-zero/shared/config-reader';

/**
 *
 * @param filePath
 */
export async function readConfig(filePath: string) {
	const { content, baseDir } = await readConfigFile<{
		comparisonHost: string;
		hooks?: readonly string[];
	}>(filePath);

	const urlList = toList(content.body);

	const pairList: [string, string][] = urlList.map((urlStr) => {
		const url = new URL(urlStr);
		return [
			url.toString(),
			`${content.attributes.comparisonHost}${url.pathname}${url.search}`,
		];
	});

	const hooks = await readPageHooks(content.attributes?.hooks ?? [], baseDir);

	return {
		pairList,
		hooks,
	};
}
