import { strToRegex } from '@d-zero/shared/str-to-regex';

/**
 * Checks whether the given HTML content contains any of the specified exclude keywords.
 * Each keyword is converted to a regular expression via `strToRegex` before testing.
 * @param html - The raw HTML string to search within.
 * @param excludeKeywords - An array of keyword strings or regex patterns to match against the HTML.
 * @returns The first matched keyword string if a match is found, or `false` if none match.
 */
export function keywordCheck(html: string, excludeKeywords: string[]) {
	for (const keyword of excludeKeywords) {
		const pattern = strToRegex(keyword);
		if (pattern.test(html)) {
			return keyword;
		}
	}

	return false;
}
