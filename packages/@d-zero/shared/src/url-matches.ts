import { decodeURISafely } from './decode-uri-safely.js';
import { normalizeUrl, type NormalizeUrlOptions } from './normalize-url.js';
import { parseUrl } from './parse-url.js';

const DEFAULT_IGNORABLE_EXTENSIONS: readonly string[] = ['.html', '.htm'];

export type UrlMatchesOptions = {
	/**
	 * File extensions to consider as equivalent for index pages.
	 * If specified, this overrides the default extensions (.html, .htm).
	 * Default extensions are only used when this option is not provided.
	 * @example [".php", ".jsp"] // Only .php and .jsp are considered, .html and .htm are ignored
	 */
	extensions?: string[];
};

/**
 * Compares two URLs and determines if they are equivalent.
 *
 * This function handles:
 * - URL encoding normalization (e.g., `%20` and space are equivalent)
 * - Trailing slash normalization (e.g., `/` and `/index` are equivalent)
 * - Index page variations (e.g., `/index`, `/index.html`, `/index.php`)
 * - Query parameter order normalization
 * - Hash and authentication information are ignored
 * @param url1 - The first URL to compare
 * @param url2 - The second URL to compare
 * @param options - Optional configuration for extension matching
 * @returns `true` if the URLs are equivalent, `false` otherwise
 * @example
 * ```ts
 * urlMatches('https://example.com/', 'https://example.com'); // true
 * urlMatches('https://example.com/index', 'https://example.com/index.html'); // true
 * urlMatches('https://example.com/index', 'https://example.com/index.php', { extensions: ['.php'] }); // true
 * ```
 */
export function urlMatches(
	url1: string,
	url2: string,
	options?: UrlMatchesOptions,
): boolean {
	// 1. 両方のURLをパース（認証情報とハッシュを無視するため、最初にパース）
	const parsed1 = parseUrl(decodeURISafely(url1));
	const parsed2 = parseUrl(decodeURISafely(url2));

	// 2. 無視可能な拡張子のリストを決定
	const ignorableExtensions = options?.extensions ?? DEFAULT_IGNORABLE_EXTENSIONS;
	const ignorableExtensionsSet = new Set(ignorableExtensions.map((e) => e.toLowerCase()));

	// 3. indexページの場合の特別な処理：拡張子が異なる場合は一致しない
	if (parsed1.isIndex && parsed2.isIndex) {
		// 両方とも拡張子がある場合、拡張子が異なる場合は一致しない
		if (
			parsed1.extname &&
			parsed2.extname &&
			parsed1.extname.toLowerCase() !== parsed2.extname.toLowerCase()
		) {
			return false;
		}
		// 一方が拡張子なし、もう一方が拡張子ありの場合、拡張子が無視不可能な場合は一致しない
		if (
			!parsed1.extname &&
			parsed2.extname &&
			!ignorableExtensionsSet.has(parsed2.extname.toLowerCase())
		) {
			return false;
		}
		if (
			parsed1.extname &&
			!parsed2.extname &&
			!ignorableExtensionsSet.has(parsed1.extname.toLowerCase())
		) {
			return false;
		}
	}

	// 4. 認証情報を無視して正規化（withoutHashAndAuthをベースに正規化）
	const normalizeOptions: NormalizeUrlOptions = {
		ignorableExtensions,
	};
	const normalized1 = normalizeUrl(parsed1.withoutHashAndAuth, normalizeOptions);
	const normalized2 = normalizeUrl(parsed2.withoutHashAndAuth, normalizeOptions);

	// 5. 正規化されたURLを直接比較
	return normalized1 === normalized2;
}
