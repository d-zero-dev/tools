/**
 * Converts a MIME type to a file extension.
 * @param mimeType - The MIME type string (may include charset and other parameters)
 * @returns The file extension with leading dot (e.g., '.html'), or empty string if unknown
 * @example
 * ```ts
 * mimeToExtension('text/html; charset=utf-8') // '.html'
 * mimeToExtension('application/javascript') // '.js'
 * mimeToExtension('unknown/type') // ''
 * ```
 */
export function mimeToExtension(mimeType?: string): string {
	if (!mimeType) {
		return '';
	}

	// Remove charset and other parameters
	const cleanMimeType = mimeType.split(';')[0]?.trim().toLowerCase();

	if (!cleanMimeType) {
		return '';
	}

	const mimeMap: Record<string, string> = {
		'text/html': '.html',
		'text/css': '.css',
		'application/javascript': '.js',
		'text/javascript': '.js',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/svg+xml': '.svg',
		'image/webp': '.webp',
		'image/gif': '.gif',
		'image/x-icon': '.ico',
		'font/woff': '.woff',
		'application/font-woff': '.woff',
		'font/woff2': '.woff2',
		'font/ttf': '.ttf',
		'application/x-font-ttf': '.ttf',
		'font/otf': '.otf',
		'application/x-font-otf': '.otf',
		'application/json': '.json',
		'application/xml': '.xml',
		'text/xml': '.xml',
	};

	return mimeMap[cleanMimeType] ?? '';
}
