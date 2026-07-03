/**
 * Normalizes raw `script`/`style`/`svg`/`noscript`/comment content before
 * hashing so that formatting differences (indentation, line breaks, minified
 * vs. pretty-printed) don't produce different hashes for otherwise-identical
 * content. Whitespace runs collapse to a single space rather than being
 * removed outright — removing them entirely would merge adjacent tokens
 * (e.g. `"var  a=1"` → `"vara=1"`) and change the content's meaning.
 * @param raw
 */
export function normalizeForHash(raw: string): string {
	return raw.trim().replaceAll(/\s+/g, ' ');
}
