import type { PageHookSource } from '@d-zero/puppeteer-page-scan';

import { toList } from '@d-zero/readtext/list';
import { readConfigFile } from '@d-zero/shared/config-reader';

/**
 * Frontmatter形式の設定ファイルを読み込み、URLペアリストとページフックの参照を返す
 * @param filePath - 設定ファイルのパス
 * @returns URLペアのリストとページフックのロード元情報
 */
export async function readConfig(filePath: string): Promise<{
	pairList: [string, string][];
	hooks: PageHookSource;
}> {
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

	return {
		pairList,
		hooks: {
			paths: content.attributes?.hooks ?? [],
			baseDir,
		},
	};
}
