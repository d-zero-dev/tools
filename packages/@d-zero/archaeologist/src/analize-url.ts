import type { URLPair } from './types.js';

type AnalyzedUrlList = {
	hasAuth: boolean;
	hasNoSSL: boolean;
};

export function analyzeUrlList(list: readonly URLPair[]): AnalyzedUrlList {
	const result: AnalyzedUrlList = {
		hasAuth: false,
		hasNoSSL: false,
	};

	for (const urlPair of list) {
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
