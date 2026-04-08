/**
 * Decodes a URL-encoded string, ensuring it is safe to use.
 *
 * This function attempts to decode a URL-encoded string using `decodeURI`.
 * If decoding fails, it returns the original string.
 * @param url - The URL-encoded string to decode.
 * @returns The decoded string, or the original string if decoding fails.
 */
export function decodeURISafely(url: string) {
	try {
		return decodeURI(url);
	} catch {
		return url;
	}
}

/**
 * Decodes a URI component-encoded string, ensuring it is safe to use.
 *
 * This function attempts to decode a URI component-encoded string using `decodeURIComponent`.
 * If decoding fails, it returns the original string.
 * @param component - The URI component-encoded string to decode.
 * @returns The decoded string, or the original string if decoding fails.
 */
export function decodeURIComponentSafely(component: string) {
	try {
		return decodeURIComponent(component);
	} catch {
		return component;
	}
}
