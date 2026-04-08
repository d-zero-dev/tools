import type { URLPair } from '../types.js';

type AnalyzedUrlList = {
	hasAuth: boolean;
	hasNoSSL: boolean;
};

/**
 * URLリストを解析し、Basic認証やHTTP（非SSL）の使用有無を判定する
 * @param list - 解析対象のURLペアまたはURL文字列のリスト
 * @returns 認証情報の有無とSSL未使用の有無
 */
export function analyzeUrlList(list: readonly (URLPair | string)[]): AnalyzedUrlList {
	const result: AnalyzedUrlList = {
		hasAuth: false,
		hasNoSSL: false,
	};

	for (const urlPair of list) {
		if (typeof urlPair === 'string') {
			const urlObj = new URL(urlPair);
			if (urlObj.username || urlObj.password) {
				result.hasAuth = true;
			}
			if (urlObj.protocol === 'http:') {
				result.hasNoSSL = true;
			}
			continue;
		}

		for (const url of urlPair) {
			const urlObj = new URL(url);
			if (urlObj.username || urlObj.password) {
				result.hasAuth = true;
			}
			if (urlObj.protocol === 'http:') {
				result.hasNoSSL = true;
			}
		}
	}

	return result;
}
