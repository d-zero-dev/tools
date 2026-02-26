import { parseUrl } from './parse-url.js';

/**
 * Validates that all URLs share the same hostname
 * @param urls - Array of URLs to validate
 * @returns The common hostname if all URLs share the same host
 * @throws {Error} if URLs have different hostnames
 * @example
 * ```ts
 * validateSameHost(['https://example.com/', 'https://example.com/page']) // 'example.com'
 * validateSameHost(['https://a.com/', 'https://b.com/']) // throws Error
 * ```
 */
export function validateSameHost(urls: string[]): string {
	if (urls.length === 0) {
		throw new Error('URL list is empty');
	}

	const firstUrl = parseUrl(urls[0]!);
	const firstHost = firstUrl.hostname;

	if (!firstHost) {
		throw new Error(`Invalid URL: ${urls[0]}`);
	}

	for (let i = 1; i < urls.length; i++) {
		const currentUrl = parseUrl(urls[i]!);
		const currentHost = currentUrl.hostname;

		if (!currentHost) {
			throw new Error(`Invalid URL: ${urls[i]}`);
		}

		if (currentHost !== firstHost) {
			throw new Error(
				`Multiple hosts detected: "${firstHost}" and "${currentHost}". All URLs must share the same hostname.`,
			);
		}
	}

	return firstHost;
}
