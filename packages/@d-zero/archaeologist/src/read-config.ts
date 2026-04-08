import { readPageHooks } from '@d-zero/puppeteer-page-scan';
import { toList } from '@d-zero/readtext/list';
import { readConfigFile } from '@d-zero/shared/config-reader';

/**
 * Frontmatter形式の設定ファイルを読み込み、URLペアリストとページフックを返す
 * @param filePath - 設定ファイルのパス
 * @returns URLペアのリストとページフック関数の配列
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
