import type { CDNType, CompressType, ParseURLOptions, ExURL } from './types.js';

import Path from 'node:path';

export function parseUrl(url: string | ExURL, options?: ParseURLOptions): ExURL | null {
	if (typeof url !== 'string') {
		return url;
	}

	try {
		const whatwgUrl = new URL(url);
		const { protocol, username, password, hostname, port, pathname, search, hash } =
			whatwgUrl;
		const isHTTP = /^https?:$/.test(protocol);
		const isSecure = protocol === 'https';

		if (!isHTTP) {
			const href = `${protocol}${pathname}`;
			return {
				href,
				_originUrlString: url,
				withoutHash: href,
				withoutHashAndAuth: href,
				protocol,
				isHTTP: false,
				isSecure: false,
				username: null,
				password: null,
				hostname: '',
				port: null,
				pathname,
				paths: [],
				depth: 0,
				dirname: null,
				basename: null,
				isIndex: false,
				extname: null,
				query: null,
				hash: null,
			};
		}

		const path = pathname.replaceAll(/\/+/g, '/');
		const paths = path.replace(/^\//, '').split('/');
		const isNoName = path.endsWith('/');
		const extname = isNoName ? null : Path.extname(path);
		const basename = isNoName ? null : Path.basename(path, extname || '');
		const dirname = path === '/' ? null : Path.dirname(path + (isNoName ? 'index' : ''));
		let query = search ? search.replace('?', '') : null;

		if (options?.disableQueries) {
			query = null;
		} else if (query) {
			const param = new URLSearchParams(query);
			param.delete('PHPSESSID');
			param.sort();
			query = param.toString();
		}

		const newSearch = query ? `?${query}` : '';

		const auth = username && password ? `${username}:${password}@` : '';
		const host = hostname + (port ? `:${port}` : '');
		const body = dirname ? `${path}${newSearch}` : newSearch ? `/${newSearch}` : '';
		const withoutHash = `${protocol}//${auth}${host}${body}`;
		const withoutHashAndAuth = `${protocol}//${host}${body}`;
		const href =
			withoutHash + (hash && !body && !withoutHash.endsWith('/') ? `/${hash}` : hash);

		return {
			href,
			_originUrlString: url,
			withoutHash,
			withoutHashAndAuth,
			protocol,
			isHTTP,
			isSecure,
			username: username || null,
			password: password || null,
			hostname,
			port: port || null,
			pathname: path || null,
			paths,
			depth: paths.length,
			dirname: dirname || null,
			basename: basename || null,
			isIndex: !basename || basename.toLowerCase() === 'index',
			extname: extname || null,
			query,
			hash: hash || null,
		};
	} catch {
		return null;
	}
}

export function isError(status: number) {
	return !(200 <= status && status < 400);
}

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
