import { removeAuth } from './remove-auth.js';

/**
 * Convert an URL to the string that is available as a file name
 *
 * @param url
 * @returns A file name safe string
 */
export function urlToFileName(url: string) {
	const urlWithoutAuth = removeAuth(url);
	const fileName = urlWithoutAuth
		// eslint-disable-next-line unicorn/better-regex
		.replaceAll(/\[id: ([\da-z][\w-]*)\]/gi, '[$1]')
		.replace(/https?:\/\//i, '')
		.replace(/\s+/, '')
		.replaceAll('?', '+')
		.replaceAll(/\/+/g, '_');
	return fileName;
}
