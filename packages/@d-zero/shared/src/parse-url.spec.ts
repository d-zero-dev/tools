import { test, expect } from 'vitest';

import { parseUrl } from './parse-url.js';

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
