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

	// Normalize empty pathname to "/"
	if (pathname === '') {
		pathname = '/';
	}

	// Remove leading slash
	if (pathname.startsWith('/')) {
		pathname = pathname.slice(1);
	}

	// If path is empty or ends with /, treat as index
	if (pathname === '' || pathname.endsWith('/')) {
		return pathname + 'index' + extension;
	}

	// Check if the last segment (after the last /) has an extension
	const lastSlashIndex = pathname.lastIndexOf('/');
	const lastSegment =
		lastSlashIndex === -1 ? pathname : pathname.slice(lastSlashIndex + 1);

	// If no extension in the last segment, add the provided extension (may be empty)
	if (!lastSegment.includes('.')) {
		return pathname + extension;
	}

	// If extension already exists in path, keep it as-is
	return pathname;
}
