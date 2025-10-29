import { parseUrl } from './parse-url.js';

/**
 * Converts a URL to a local file path.
 * @param url - The URL to convert
 * @param extension - The file extension to add (with leading dot, e.g., '.html')
 * @returns The local file path (without leading slash)
 * @example
 * ```ts
 * urlToLocalPath('https://example.com/', '.html') // 'index.html'
 * urlToLocalPath('https://example.com/path/', '.html') // 'path/index.html'
 * urlToLocalPath('https://example.com/file', '.html') // 'file.html'
 * urlToLocalPath('https://example.com/file.js', '') // 'file.js'
 * ```
 */
export function urlToLocalPath(url: string, extension: string): string {
	const parsed = parseUrl(url);
	let pathname = parsed.pathname ?? '/';

	// Remove leading slash
	if (pathname.startsWith('/')) {
		pathname = pathname.slice(1);
	}

	// If path is empty or ends with /, treat as index (with optional extension)
	if (pathname === '' || pathname.endsWith('/')) {
		return pathname + 'index' + extension;
	}

	// If no extension in path, add the provided extension (may be empty)
	if (!pathname.includes('.')) {
		return pathname + extension;
	}

	// If extension already exists in path, keep it as-is
	return pathname;
}
