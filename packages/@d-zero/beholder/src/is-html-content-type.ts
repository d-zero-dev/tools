/**
 * Determine whether a Content-Type media type is HTML.
 *
 * MIME types are case-insensitive (RFC 2045). Surrounding whitespace after
 * parameter stripping is also tolerated so `text/html `, `Text/HTML`, and
 * `text/html; charset=utf-8` (after `;` split) all classify as HTML.
 * @param contentType - The media type portion of a Content-Type header
 *   (parameters already stripped), or `null` when unknown.
 * @returns `true` when the media type is `text/html` in any letter case.
 * @example
 * ```ts
 * isHtmlContentType('text/html'); // true
 * isHtmlContentType('Text/HTML'); // true
 * isHtmlContentType('application/pdf'); // false
 * // Callers should strip parameters first (e.g. split on ';') before calling.
 * ```
 */
export function isHtmlContentType(contentType: string | null): boolean {
	return contentType !== null && contentType.trim().toLowerCase() === 'text/html';
}
