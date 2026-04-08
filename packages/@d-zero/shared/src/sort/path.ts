import type { ExURL } from '../parse-url.js';

import path from 'node:path';

import { pathToURL } from '../path-to-url.js';

import { alphabeticalComparator } from './alphabetical.js';
import { dirComparator } from './dir.js';
import { numericalComparator } from './numerical.js';

interface URLParts {
	readonly hostname: string;
	readonly paths: readonly string[];
	readonly basename: string;
	readonly isIndex: boolean;
	readonly extname: string;
	readonly search: string;
	readonly hash: string;
	readonly protocol: string;
	readonly href: string;
	readonly original: string;
}

/**
 *
 * @param url
 */
function isExURL(url: unknown): url is ExURL {
	return typeof url === 'object' && url !== null && '_originUrlString' in url;
}

/**
 *
 * @param url
 */
function toURLParts(url: string | URL | ExURL): URLParts {
	if (isExURL(url)) {
		return {
			hostname: url.hostname,
			paths: url.paths,
			basename: url.basename ?? '',
			isIndex: url.isIndex,
			extname: url.extname ?? '',
			search: url.query ?? '',
			hash: url.hash ?? '',
			protocol: url.protocol,
			href: url.href,
			original: url._originUrlString,
		};
	}

	const u = typeof url === 'string' ? pathToURL(url) : url;
	const pathSegments = u.pathname.split('/');
	const lastSegment = pathSegments.at(-1) ?? pathSegments.at(0) ?? '';

	return {
		hostname: u.hostname,
		paths: pathSegments,
		basename: lastSegment,
		isIndex: lastSegment.toLowerCase() === 'index' || lastSegment === '',
		extname: path.extname(lastSegment),
		search: u.search,
		hash: u.hash,
		protocol: u.protocol,
		href: u.href,
		original: typeof url === 'string' ? url : u.href,
	};
}

/**
 * Compares two URLs or strings representing URLs and returns a value indicating their order.
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
 * @param url1 - The first URL or string representing a URL to compare.
 * @param url2 - The second URL or string representing a URL to compare.
 * @returns A value indicating the order of the URLs: 0 if they are equal, -1 if the first URL comes before the second URL, 1 if the first URL comes after the second URL.
 */
export function pathComparator(
	url1: string | URL | ExURL,
	url2: string | URL | ExURL,
): 0 | -1 | 1 {
	const u1 = toURLParts(url1);
	const u2 = toURLParts(url2);

	if (u1.href === u2.href) {
		return alphabeticalComparator(u1.original, u2.original);
	}

	const rHost = alphabeticalComparator(u1.hostname, u2.hostname);
	if (rHost) {
		return rHost;
	}

	const rPaths = dirComparator(u1.paths, u2.paths);
	if (rPaths) {
		return rPaths;
	}

	if (u1.basename !== u2.basename) {
		if (u1.isIndex) return -1;
		if (u2.isIndex) return 1;

		const rBasename = numericalComparator(u1.basename, u2.basename);
		if (rBasename) {
			return rBasename;
		}
	}

	const rExt = numericalComparator(u1.extname, u2.extname);
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

	const rProtocol = alphabeticalComparator(u1.protocol, u2.protocol);
	if (rProtocol) {
		return rProtocol;
	}

	return numericalComparator(u1.href, u2.href);
}
