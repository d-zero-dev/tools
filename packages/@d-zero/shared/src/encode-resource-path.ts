import type { ExURL } from './parse-url.js';

/**
 * Extract pathname from URL, string, or ExURL
 * @param input - URL object, URL string, or ExURL object
 * @returns Pathname string
 */
function extractPathname(input: URL | string | ExURL): string {
	if (input instanceof URL) {
		return input.pathname;
	}
	if (typeof input === 'string') {
		const url = new URL(input);
		return url.pathname;
	}
	// ExURL
	return input.pathname ?? '/';
}

/**
 * Encode resource path with MIME type if needed
 * @param urlOrStringOrExUrl - URL object, URL string, or ExURL object
 * @param mimeType - MIME type (optional)
 * @param separator - Separator string between pathname and MIME type (default: ":::")
 * @returns Encoded resource path
 */
export function encodeResourcePath(
	urlOrStringOrExUrl: URL | string | ExURL,
	mimeType?: string,
	separator: string = ':::',
): string {
	let pathname = extractPathname(urlOrStringOrExUrl);

	// Normalize empty pathname to "/"
	if (pathname === '') {
		pathname = '/';
	}

	// Check if the last segment has an extension
	const lastSlashIndex = pathname.lastIndexOf('/');
	const lastSegment =
		lastSlashIndex === -1 ? pathname : pathname.slice(lastSlashIndex + 1);
	const hasExtension = lastSegment.includes('.');

	// For paths without extension, encode with MIME type if available
	if (!hasExtension && mimeType) {
		return `${pathname}${separator}${mimeType}`;
	}

	// For paths with extension or without MIME type, return as-is
	return pathname;
}

/**
 * Decode resource path and extract pathname and MIME type
 * @param encodedPath - Encoded resource path (e.g., "/page:::text/html" or "/style.css")
 * @param separator - Separator string between pathname and MIME type (default: ":::")
 * @returns Object with pathname and mimeType (null if not encoded)
 */
export function decodeResourcePath(
	encodedPath: string,
	separator: string = ':::',
): { pathname: string; mimeType: string | null } {
	// If separator is empty, treat as not encoded
	if (separator === '') {
		return { pathname: encodedPath, mimeType: null };
	}

	// Find the last occurrence of separator to handle cases where pathname might contain the separator
	const lastSeparatorIndex = encodedPath.lastIndexOf(separator);

	// If separator not found, treat as not encoded
	if (lastSeparatorIndex === -1) {
		return { pathname: encodedPath, mimeType: null };
	}

	// Split at the last separator
	const pathname = encodedPath.slice(0, lastSeparatorIndex);
	const mimeType = encodedPath.slice(lastSeparatorIndex + separator.length);

	// If mimeType is empty after split, treat as not encoded
	if (mimeType === '') {
		return { pathname: encodedPath, mimeType: null };
	}

	return { pathname, mimeType };
}
