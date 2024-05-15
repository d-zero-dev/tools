import path from 'node:path';

import { pathToURL } from '../path-to-url.js';

import { alphabeticalComparator } from './alphabetical.js';
import { dirComparator } from './dir.js';
import { numericalComparator } from './numerical.js';

/**
 * Compares two URLs or strings representing URLs and returns a value indicating their order.
 *
 * @example
 * ```ts
 * import { pathComparator } from '@d-zero/shared/sort/path';
 *
 * const urls = [
 * 	'https://hostname.domain/10',
 * 	'https://hostname.domain/2',
 * 	'https://hostname.domain/1',
 * 	'https://hostname.domain/100',
 * 	'https://hostname.domain/4',
 * 	'https://hostname.domain/22',
 * ];
 *
 * urls.sort(pathComparator);
 * ```
 *
 * @param url1 - The first URL or string representing a URL to compare.
 * @param url2 - The second URL or string representing a URL to compare.
 * @returns A value indicating the order of the URLs: 0 if they are equal, -1 if the first URL comes before the second URL, 1 if the first URL comes after the second URL.
 */
export function pathComparator(url1: string | URL, url2: string | URL): 0 | -1 | 1 {
	const u1 = typeof url1 === 'string' ? pathToURL(url1) : url1;
	const u2 = typeof url2 === 'string' ? pathToURL(url2) : url2;

	const rHost = alphabeticalComparator(u1.hostname, u2.hostname);
	if (rHost) {
		return rHost;
	}

	const paths1 = u1.pathname.split('/');
	const paths2 = u2.pathname.split('/');
	const rPaths = dirComparator(paths1, paths2);
	if (rPaths) {
		return rPaths;
	}

	const basename1 = paths1.at(-1) ?? paths1.at(0) ?? '';
	const basename2 = paths2.at(-1) ?? paths2.at(0) ?? '';
	const ext1 = path.extname(basename1);
	const ext2 = path.extname(basename2);

	if (basename1 !== basename2) {
		const isIndex1 = basename1.toLowerCase() === 'index' || basename1 === '';
		const isIndex2 = basename2.toLowerCase() === 'index' || basename2 === '';

		if (isIndex1) return -1;
		if (isIndex2) return 1;

		const rBasename = numericalComparator(basename1, basename2);
		if (rBasename) {
			return rBasename;
		}
	}

	const rExt = numericalComparator(ext1, ext2);
	if (rExt) {
		return rExt;
	}

	const rSearch = numericalComparator(u1.search, u2.search);
	if (rSearch) {
		return rSearch;
	}

	const rHash = numericalComparator(u1.hash, u2.hash);
	if (rHash) {
		return rHash;
	}

	if (!(u1.protocol.startsWith('http') && u2.protocol.startsWith('http'))) {
		const rProtocol = alphabeticalComparator(u1.protocol, u2.protocol);
		if (rProtocol) {
			return rProtocol;
		}
	}

	const rHref = numericalComparator(u1.href, u2.href);
	if (rHref) {
		return rHref;
	}

	if (typeof url1 === 'string' && typeof url2 === 'string') {
		return alphabeticalComparator(url1, url2);
	}

	return 0;
}
