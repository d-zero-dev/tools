export type CompressType =
	| 'gzip'
	| 'compress'
	| 'deflate'
	| 'br'
	| 'sdch'
	| 'vcdiff'
	| 'xdelta';

/**
 * Detects the HTTP response compression algorithm from the `Content-Encoding` header.
 * Supports gzip, br (Brotli), compress, deflate, sdch, vcdiff, and xdelta.
 * @param headers - The HTTP response headers object.
 * @returns The detected compression type string (e.g., `'gzip'`, `'br'`),
 *          or `false` if no compression encoding is detected.
 */
export function detectCompress(
	headers: Record<string, string | string[] | undefined>,
): false | CompressType {
	const raw = headers['content-encoding'];
	const enc = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');

	if (/gzip/i.test(enc)) {
		return 'gzip';
	}

	if (/br/i.test(enc)) {
		return 'br';
	}

	if (/compress/i.test(enc)) {
		return 'compress';
	}

	if (/deflate/i.test(enc)) {
		return 'deflate';
	}

	if (/sdch/i.test(enc)) {
		return 'sdch';
	}

	if (/vcdiff/i.test(enc)) {
		return 'vcdiff';
	}

	if (/xdelta/i.test(enc)) {
		return 'xdelta';
	}

	return false;
}
