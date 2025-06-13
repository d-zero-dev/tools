import type { CDNType, CompressType } from './types.js';

/**
 *
 * @param status
 */
export function isError(status: number) {
	return !(200 <= status && status < 400);
}

/**
 *
 * @param headers
 */
export function detectCompress(
	headers: Record<string, string | string[] | undefined>,
): false | CompressType {
	const enc =
		'content-encoding' in headers && typeof headers['content-encoding'] === 'string'
			? headers['content-encoding']
			: '';
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

	// cspell:disable-next
	if (/sdch/i.test(enc)) {
		// cspell:disable-next
		return 'sdch';
	}

	// cspell:disable-next
	if (/vcdiff/i.test(enc)) {
		// cspell:disable-next
		return 'vcdiff';
	}

	// cspell:disable-next
	if (/xdelta/i.test(enc)) {
		// cspell:disable-next
		return 'xdelta';
	}

	return false;
}

/**
 *
 * @param headers
 */
export function detectCDN(
	headers: Record<string, string | string[] | undefined>,
): false | CDNType {
	if ('X-Akamai-Transformed' in headers) {
		return 'Akamai';
	}

	if ('x-amz-cf-pop' in headers) {
		return 'Amazon CloudFront';
	}

	if ('X-IIJ-Cache' in headers) {
		return 'IIJ';
	}

	if (typeof headers.server === 'string') {
		if (/cloudflare/i.test(headers.server)) {
			return 'Cloudflare';
		}
		if (/amazons3/i.test(headers.server)) {
			return 'Amazon S3';
		}
		return false;
	}

	return false;
}
