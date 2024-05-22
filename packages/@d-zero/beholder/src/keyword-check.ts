import { strToRegex } from '@d-zero/shared/str-to-regex';

export function keywordCheck(html: string, excludeKeywords: string[]) {
	for (const keyword of excludeKeywords) {
		const pattern = strToRegex(keyword);
		if (pattern.test(html)) {
			return keyword;
		}
	}

	return false;
}
