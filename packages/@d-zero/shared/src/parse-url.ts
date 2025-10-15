import Path from 'node:path';

export type ExURL = {
	/**
	 * Full URL (optimized)
	 */
	href: string;

	/**
	 * Full URL that before parse
	 */
	_originUrlString: string;

	/**
	 * Full URL without hash
	 */
	withoutHash: string;

	/**
	 * Full URL without hash and Authentication
	 */
	withoutHashAndAuth: string;

	/**
	 * Protocol or URI scheme (includes ":")
	 * - case-insensitive
	 */
	protocol: string;

	/**
	 * Whether protocol is HTTP or HTTPS
	 */
	isHTTP: boolean;

	/**
	 * Whether protocol is HTTPS
	 */
	isSecure: boolean;

	/**
	 * User name of authentication
	 */
	username: string | null;

	/**
	 * Password of authentication
	 */
	password: string | null;

	/**
	 * Host name
	 *
	 * - case-insensitive
	 * - encode non-ASCII characters
	 * - without port number
	 */
	hostname: string;

	/**
	 * Port number
	 */
	port: string | null;

	/**
	 * Path part
	 *
	 * It is only `/` if pathname is empty
	 *
	 * - case-sensitive
	 */
	pathname: string | null;

	/**
	 * Array of path
	 */
	paths: string[];

	/**
	 * Depth of paths
	 */
	depth: number;

	/**
	 * Directory name of paths
	 *
	 * It is null if it is `/` only
	 */
	dirname: string | null;

	/**
	 * Base name of paths (File name without file extension)
	 */
	basename: string | null;

	/**
	 * Whether index page (It's true if basename is null)
	 */
	isIndex: boolean;

	/**
	 * File extension name (inclues ".")
	 */
	extname: string | null;

	/**
	 * Search query (without `?`)
	 *
	 * - case-sensitive
	 */
	query: string | null;

	/**
	 * Hash (includes `#`)
	 *
	 * - case-sensitive
	 */
	hash: string | null;
};

export type ParseURLOptions = {
	disableQueries?: boolean;
};

/**
 * Parse URL string to ExURL object
 * @param url URL string to parse
 * @param options Parse options
 * @returns ExURL object
 */
export function parseUrl(url: string, options?: ParseURLOptions): ExURL {
	try {
		const whatwgUrl = new URL(url);
		const { protocol, username, password, hostname, port, pathname, search, hash } =
			whatwgUrl;
		const isHTTP = /^https?:$/.test(protocol);
		const isSecure = protocol === 'https:';

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
		return {
			href: url,
			_originUrlString: url,
			withoutHash: url,
			withoutHashAndAuth: url,
			protocol: '',
			isHTTP: false,
			isSecure: false,
			username: null,
			password: null,
			hostname: '',
			port: null,
			pathname: null,
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
}
