export type CDNType = 'Amazon S3' | 'Amazon CloudFront' | 'IIJ' | 'Cloudflare' | 'Akamai';

/**
 * Detects the CDN provider from HTTP response headers.
 * Identifies Akamai, Amazon CloudFront, Amazon S3, IIJ, and Cloudflare
 * based on their characteristic response headers.
 * @param headers - The HTTP response headers object.
 * @returns The detected CDN provider name (e.g., `'Cloudflare'`, `'Akamai'`),
 *          or `false` if no known CDN is detected.
 */
export function detectCDN(
	headers: Record<string, string | string[] | undefined>,
): false | CDNType {
	const lowerKeys = new Set(Object.keys(headers).map((k) => k.toLowerCase()));

	if (lowerKeys.has('x-akamai-transformed')) {
		return 'Akamai';
	}

	if (lowerKeys.has('x-amz-cf-pop')) {
		return 'Amazon CloudFront';
	}

	if (lowerKeys.has('x-iij-cache')) {
		return 'IIJ';
	}

	const server = Object.entries(headers).find(([k]) => k.toLowerCase() === 'server')?.[1];
	if (typeof server === 'string') {
		if (/cloudflare/i.test(server)) {
			return 'Cloudflare';
		}
		if (/amazons3/i.test(server)) {
			return 'Amazon S3';
		}
	}

	return false;
}
