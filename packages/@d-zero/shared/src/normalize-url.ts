import { decodeURISafely, decodeURIComponentSafely } from './decode-uri-safely.js';
import { parseUrl } from './parse-url.js';

export type NormalizeUrlOptions = {
	/**
	 * File extensions that should be ignored for index pages.
	 * @example ['.html', '.htm'] or ['.php', '.jsp']
	 */
	ignorableExtensions?: readonly string[];
};

/**
 * Normalizes a URL for comparison purposes.
 *
 * This function:
 * - Normalizes URL encoding (decodes for parsing, then encodes for output)
 * - Normalizes path segments (handled by `parseUrl`)
 * - Normalizes trailing slashes
 * - Normalizes index page variations (e.g., `/index`, `/index.html` → `/`)
 * - Normalizes query parameter order (handled by `parseUrl`)
 * - Removes hash segments
 *
 * Note: Authentication information is preserved in the normalized URL.
 * It should be ignored during comparison using `withoutHashAndAuth`.
 * @param url - The URL to normalize
 * @param options - Optional configuration for extension matching
 * @returns A normalized URL string suitable for comparison
 */
export function normalizeUrl(url: string, options?: NormalizeUrlOptions): string {
	// 1. URLエンコード正規化
	const decoded = decodeURISafely(url);

	// 2. パース
	const parsed = parseUrl(decoded);

	// 3. パス名の正規化
	let normalizedPath: string;

	if (parsed.isIndex) {
		// indexページの場合
		const ignorableExtensionsSet = new Set(
			(options?.ignorableExtensions ?? []).map((e) => e.toLowerCase()),
		);

		if (parsed.stem === '/') {
			// ルートのindex（/index, /index.htmlなど）
			if (parsed.extname && !ignorableExtensionsSet.has(parsed.extname.toLowerCase())) {
				normalizedPath = `/index${parsed.extname}`;
			} else {
				normalizedPath = '/';
			}
		} else if (parsed.basename === null) {
			// /path/ のような場合（basenameがnullでisIndex=true）
			// /path/ のまま保持（/path/index と等価にするため）
			normalizedPath = parsed.stem;
		} else if (parsed.stem.endsWith('/')) {
			// /path/index → /path/ に正規化
			normalizedPath = parsed.stem;
			if (parsed.extname && !ignorableExtensionsSet.has(parsed.extname.toLowerCase())) {
				normalizedPath += `index${parsed.extname}`;
			}
		} else {
			// 通常は発生しないが、念のため
			normalizedPath = parsed.stem;
			if (parsed.extname && !ignorableExtensionsSet.has(parsed.extname.toLowerCase())) {
				normalizedPath += parsed.extname;
			}
		}
	} else {
		// indexページでない場合
		if (parsed.stem === '/') {
			// ルートはそのまま
			normalizedPath = '/';
		} else {
			// 末尾スラッシュを削除（/path/ → /path）
			normalizedPath = parsed.stem.replace(/\/$/, '');
			if (parsed.extname) {
				normalizedPath += parsed.extname;
			}
		}
	}

	// 4. 正規化されたURLを構築
	const protocol = parsed.protocol.toLowerCase();
	const auth =
		parsed.username && parsed.password ? `${parsed.username}:${parsed.password}@` : '';
	const host = parsed.port
		? `${parsed.hostname.toLowerCase()}:${parsed.port}`
		: parsed.hostname.toLowerCase();
	const path = normalizedPath
		.split('/')
		.map((segment) =>
			segment ? encodeURIComponent(decodeURIComponentSafely(segment)) : '',
		)
		.join('/');
	const query = parsed.query ? `?${parsed.query}` : '';

	return `${protocol}//${auth}${host}${path}${query}`;
}
