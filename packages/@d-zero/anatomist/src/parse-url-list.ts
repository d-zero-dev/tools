export type UrlListFormat = 'lines' | 'json';

/**
 * Parses a URL list from text, in one of two formats:
 * - `lines` (default): one URL per line; blank lines and lines starting
 *   with `#` are ignored, so a list can carry comments.
 * - `json`: a JSON array of strings.
 * @param text - The raw file/stdin contents.
 * @param format - Default `'lines'`.
 * @throws {Error} When `format` is `'json'` and `text` doesn't parse as a
 *   JSON array of strings.
 * @example
 * ```ts
 * parseUrlList('https://a.example/\n# comment\nhttps://b.example/');
 * // ['https://a.example/', 'https://b.example/']
 * ```
 */
export function parseUrlList(text: string, format: UrlListFormat = 'lines'): string[] {
	if (format === 'json') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (error) {
			throw new Error(`failed to parse URL list as JSON: ${(error as Error).message}`);
		}
		if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
			throw new TypeError('URL list JSON must be an array of strings');
		}
		return parsed;
	}

	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'));
}
