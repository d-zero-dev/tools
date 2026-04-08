import { describe, test, it, expect } from 'vitest';

import { parseUrl, tryParseUrl } from './parse-url.js';

test('Create tree', () => {
	expect(parseUrl('https://example.com/')).toStrictEqual({
		_originUrlString: 'https://example.com/',
		basename: null,
		depth: 1,
		dirname: null,
		extname: null,
		stem: '/',
		hash: null,
		hostname: 'example.com',
		href: 'https://example.com',
		isHTTP: true,
		isIndex: true,
		isSecure: true,
		password: null,
		pathname: '/',
		paths: [''],
		port: null,
		protocol: 'https:',
		query: null,
		username: null,
		withoutHash: 'https://example.com',
		withoutHashAndAuth: 'https://example.com',
	});

	expect(parseUrl('https://example.com')).toStrictEqual({
		_originUrlString: 'https://example.com',
		basename: null,
		depth: 1,
		dirname: null,
		extname: null,
		stem: '/',
		hash: null,
		hostname: 'example.com',
		href: 'https://example.com',
		isHTTP: true,
		isIndex: true,
		isSecure: true,
		password: null,
		pathname: '/',
		paths: [''],
		port: null,
		protocol: 'https:',
		query: null,
		username: null,
		withoutHash: 'https://example.com',
		withoutHashAndAuth: 'https://example.com',
	});

	expect(parseUrl('https://example.com/a/b/c')).toStrictEqual({
		_originUrlString: 'https://example.com/a/b/c',
		basename: 'c',
		depth: 3,
		dirname: '/a/b',
		extname: null,
		stem: '/a/b/c',
		hash: null,
		hostname: 'example.com',
		href: 'https://example.com/a/b/c',
		isHTTP: true,
		isIndex: false,
		isSecure: true,
		password: null,
		pathname: '/a/b/c',
		paths: ['a', 'b', 'c'],
		port: null,
		protocol: 'https:',
		query: null,
		username: null,
		withoutHash: 'https://example.com/a/b/c',
		withoutHashAndAuth: 'https://example.com/a/b/c',
	});

	expect(parseUrl('https://example.com/a/b/c.html')).toStrictEqual({
		_originUrlString: 'https://example.com/a/b/c.html',
		basename: 'c',
		depth: 3,
		dirname: '/a/b',
		extname: '.html',
		stem: '/a/b/c',
		hash: null,
		hostname: 'example.com',
		href: 'https://example.com/a/b/c.html',
		isHTTP: true,
		isIndex: false,
		isSecure: true,
		password: null,
		pathname: '/a/b/c.html',
		paths: ['a', 'b', 'c.html'],
		port: null,
		protocol: 'https:',
		query: null,
		username: null,
		withoutHash: 'https://example.com/a/b/c.html',
		withoutHashAndAuth: 'https://example.com/a/b/c.html',
	});

	expect(parseUrl('https://example.com/a/b/c/index.html')).toStrictEqual({
		_originUrlString: 'https://example.com/a/b/c/index.html',
		basename: 'index',
		depth: 4,
		dirname: '/a/b/c',
		extname: '.html',
		stem: '/a/b/c/',
		hash: null,
		hostname: 'example.com',
		href: 'https://example.com/a/b/c/index.html',
		isHTTP: true,
		isIndex: true,
		isSecure: true,
		password: null,
		pathname: '/a/b/c/index.html',
		paths: ['a', 'b', 'c', 'index.html'],
		port: null,
		protocol: 'https:',
		query: null,
		username: null,
		withoutHash: 'https://example.com/a/b/c/index.html',
		withoutHashAndAuth: 'https://example.com/a/b/c/index.html',
	});

	expect(parseUrl('https://host/a.html').stem).toBe('/a');
	expect(parseUrl('https://host/a/b.html').stem).toBe('/a/b');

	expect(parseUrl('https://host/a/index.html', { indexAsParent: false }).depth).toBe(2);
	expect(parseUrl('https://host/a/index.html', { indexAsParent: true }).depth).toBe(1);
});

describe('tryParseUrl', () => {
	describe('Non-URL', () => {
		it('tel', () => {
			expect(tryParseUrl('tel:000-0000-0000')?.href).toBe('tel:000-0000-0000');
		});
		it('javascript', () => {
			expect(tryParseUrl('JavaScript:void(0)')?.href).toBe('javascript:void(0)');
		});
	});

	describe('optimize', () => {
		it('Non-ASCII, Case-Insensitive', () => {
			expect(tryParseUrl('hTTps://Hostname.マルチバイト.Domain///A/B/C')?.href).toBe(
				'https://hostname.xn--eckxcwa4a9dyd.domain/A/B/C',
			);
		});

		it('Last slash', () => {
			expect(tryParseUrl('https://hostname.domain')?.href).toBe(
				'https://hostname.domain',
			);
			expect(tryParseUrl('https://hostname.domain/')?.href).toBe(
				'https://hostname.domain',
			);
			expect(tryParseUrl('https://hostname.domain?q')?.href).toBe(
				'https://hostname.domain/?q=',
			);
			expect(tryParseUrl('https://hostname.domain#h')?.href).toBe(
				'https://hostname.domain/#h',
			);
			expect(tryParseUrl('https://hostname.domain?q#h')?.href).toBe(
				'https://hostname.domain/?q=#h',
			);
			expect(tryParseUrl('https://hostname.domain/a')?.href).toBe(
				'https://hostname.domain/a',
			);
			expect(tryParseUrl('https://hostname.domain/a/')?.href).toBe(
				'https://hostname.domain/a/',
			);
			expect(tryParseUrl('https://hostname.domain/a?q')?.href).toBe(
				'https://hostname.domain/a?q=',
			);
			expect(tryParseUrl('https://hostname.domain/a#h')?.href).toBe(
				'https://hostname.domain/a#h',
			);
			expect(tryParseUrl('https://hostname.domain/a?q#h')?.href).toBe(
				'https://hostname.domain/a?q=#h',
			);
		});
	});

	it('returns null for invalid URL', () => {
		expect(tryParseUrl('not a url')).toBeNull();
		expect(tryParseUrl('')).toBeNull();
	});

	it('passes through ExURL objects', () => {
		const exUrl = parseUrl('https://example.com/');
		expect(tryParseUrl(exUrl)).toBe(exUrl);
	});

	it('paths', () => {
		expect(tryParseUrl('https://hostname.domain')).toEqual(
			expect.objectContaining({
				pathname: '/',
				paths: [''],
				depth: 1,
				dirname: null,
				basename: null,
				isIndex: true,
				extname: null,
			}),
		);

		expect(tryParseUrl('https://hostname.domain/a/b/c')).toEqual(
			expect.objectContaining({
				pathname: '/a/b/c',
				paths: ['a', 'b', 'c'],
				depth: 3,
				dirname: '/a/b',
				basename: 'c',
				isIndex: false,
				extname: null,
			}),
		);

		expect(tryParseUrl('https://hostname.domain/a/b/c/')).toEqual(
			expect.objectContaining({
				pathname: '/a/b/c/',
				paths: ['a', 'b', 'c', ''],
				depth: 4,
				dirname: '/a/b/c',
				basename: null,
				isIndex: true,
				extname: null,
			}),
		);

		expect(tryParseUrl('https://hostname.domain/a/b/c/index.html')).toEqual(
			expect.objectContaining({
				pathname: '/a/b/c/index.html',
				paths: ['a', 'b', 'c', 'index.html'],
				depth: 4,
				dirname: '/a/b/c',
				basename: 'index',
				isIndex: true,
				extname: '.html',
			}),
		);

		expect(tryParseUrl('https://hostname.domain/a/b/c/d.html')).toEqual(
			expect.objectContaining({
				pathname: '/a/b/c/d.html',
				paths: ['a', 'b', 'c', 'd.html'],
				depth: 4,
				dirname: '/a/b/c',
				basename: 'd',
				isIndex: false,
				extname: '.html',
			}),
		);

		expect(tryParseUrl('https://hostname.domain/a/b/c/.d')).toEqual(
			expect.objectContaining({
				pathname: '/a/b/c/.d',
				paths: ['a', 'b', 'c', '.d'],
				depth: 4,
				dirname: '/a/b/c',
				basename: '.d',
				isIndex: false,
				extname: null,
			}),
		);
	});

	it('query', () => {
		expect(tryParseUrl('https://hostname.domain/?a=b')).toEqual(
			expect.objectContaining({
				withoutHash: 'https://hostname.domain/?a=b',
				pathname: '/',
				paths: [''],
				depth: 1,
				dirname: null,
				basename: null,
				isIndex: true,
				extname: null,
				query: 'a=b',
			}),
		);
		expect(tryParseUrl('https://hostname.domain/?a=b', { disableQueries: true })).toEqual(
			expect.objectContaining({
				withoutHash: 'https://hostname.domain',
				pathname: '/',
				paths: [''],
				depth: 1,
				dirname: null,
				basename: null,
				isIndex: true,
				extname: null,
				query: null,
			}),
		);
	});
});
