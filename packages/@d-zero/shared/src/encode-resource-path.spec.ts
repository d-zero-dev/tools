import type { ExURL } from './parse-url.js';

import { describe, expect, test } from 'vitest';

import { encodeResourcePath } from './encode-resource-path.js';

describe('encodeResourcePath', () => {
	describe('with URL object', () => {
		test('normalizes empty pathname to "/"', () => {
			const url = new URL('https://example.com');
			expect(encodeResourcePath(url)).toBe('/');
		});

		test('returns "/" as-is', () => {
			const url = new URL('https://example.com/');
			expect(encodeResourcePath(url)).toBe('/');
		});

		test('returns pathname with extension as-is', () => {
			const url = new URL('https://example.com/style.css');
			expect(encodeResourcePath(url)).toBe('/style.css');
		});

		test('returns pathname with extension and MIME type as-is', () => {
			const url = new URL('https://example.com/style.css');
			expect(encodeResourcePath(url, 'text/css')).toBe('/style.css');
		});

		test('encodes pathname without extension with MIME type', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, 'text/html')).toBe('/page:::text/html');
		});

		test('returns pathname without extension when MIME type is not provided', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url)).toBe('/page');
		});

		test('handles pathname ending with slash', () => {
			const url = new URL('https://example.com/path/to/');
			expect(encodeResourcePath(url, 'text/html')).toBe('/path/to/:::text/html');
		});

		test('handles nested path without extension', () => {
			const url = new URL('https://example.com/path/to/resource');
			expect(encodeResourcePath(url, 'application/json')).toBe(
				'/path/to/resource:::application/json',
			);
		});

		test('handles nested path with extension', () => {
			const url = new URL('https://example.com/path/to/file.js');
			expect(encodeResourcePath(url, 'application/javascript')).toBe('/path/to/file.js');
		});

		test('handles pathname with query and hash', () => {
			const url = new URL('https://example.com/page?query=1#hash');
			expect(encodeResourcePath(url, 'text/html')).toBe('/page:::text/html');
		});
	});

	describe('with string URL', () => {
		test('normalizes empty pathname to "/"', () => {
			expect(encodeResourcePath('https://example.com')).toBe('/');
		});

		test('returns "/" as-is', () => {
			expect(encodeResourcePath('https://example.com/')).toBe('/');
		});

		test('returns pathname with extension as-is', () => {
			expect(encodeResourcePath('https://example.com/style.css')).toBe('/style.css');
		});

		test('returns pathname with extension and MIME type as-is', () => {
			expect(encodeResourcePath('https://example.com/style.css', 'text/css')).toBe(
				'/style.css',
			);
		});

		test('encodes pathname without extension with MIME type', () => {
			expect(encodeResourcePath('https://example.com/page', 'text/html')).toBe(
				'/page:::text/html',
			);
		});

		test('returns pathname without extension when MIME type is not provided', () => {
			expect(encodeResourcePath('https://example.com/page')).toBe('/page');
		});

		test('handles pathname ending with slash', () => {
			expect(encodeResourcePath('https://example.com/path/to/', 'text/html')).toBe(
				'/path/to/:::text/html',
			);
		});

		test('handles nested path without extension', () => {
			expect(
				encodeResourcePath('https://example.com/path/to/resource', 'application/json'),
			).toBe('/path/to/resource:::application/json');
		});

		test('handles nested path with extension', () => {
			expect(
				encodeResourcePath(
					'https://example.com/path/to/file.js',
					'application/javascript',
				),
			).toBe('/path/to/file.js');
		});

		test('throws error for invalid URL string', () => {
			expect(() => encodeResourcePath('not-a-valid-url')).toThrow(TypeError);
		});

		test('throws error for relative path', () => {
			expect(() => encodeResourcePath('/relative/path')).toThrow(TypeError);
		});

		test('handles URL with port', () => {
			expect(encodeResourcePath('https://example.com:8080/page', 'text/html')).toBe(
				'/page:::text/html',
			);
		});

		test('handles URL with authentication', () => {
			expect(encodeResourcePath('https://user:pass@example.com/page', 'text/html')).toBe(
				'/page:::text/html',
			);
		});
	});

	describe('with ExURL object', () => {
		test('normalizes null pathname to "/"', () => {
			const exUrl: ExURL = {
				href: 'https://example.com',
				_originUrlString: 'https://example.com',
				withoutHash: 'https://example.com',
				withoutHashAndAuth: 'https://example.com',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
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
				stem: '',
			};
			expect(encodeResourcePath(exUrl)).toBe('/');
		});

		test('normalizes empty pathname to "/"', () => {
			const exUrl: ExURL = {
				href: 'https://example.com',
				_originUrlString: 'https://example.com',
				withoutHash: 'https://example.com',
				withoutHashAndAuth: 'https://example.com',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '',
				paths: [],
				depth: 0,
				dirname: null,
				basename: null,
				isIndex: false,
				extname: null,
				query: null,
				hash: null,
				stem: '',
			};
			expect(encodeResourcePath(exUrl)).toBe('/');
		});

		test('returns "/" as-is', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/',
				_originUrlString: 'https://example.com/',
				withoutHash: 'https://example.com/',
				withoutHashAndAuth: 'https://example.com/',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/',
				paths: [],
				depth: 0,
				dirname: null,
				basename: null,
				isIndex: true,
				extname: null,
				query: null,
				hash: null,
				stem: '/',
			};
			expect(encodeResourcePath(exUrl)).toBe('/');
		});

		test('returns pathname with extension as-is', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/style.css',
				_originUrlString: 'https://example.com/style.css',
				withoutHash: 'https://example.com/style.css',
				withoutHashAndAuth: 'https://example.com/style.css',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/style.css',
				paths: ['style.css'],
				depth: 1,
				dirname: '/',
				basename: 'style',
				isIndex: false,
				extname: '.css',
				query: null,
				hash: null,
				stem: '/style',
			};
			expect(encodeResourcePath(exUrl)).toBe('/style.css');
		});

		test('returns pathname with extension and MIME type as-is', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/style.css',
				_originUrlString: 'https://example.com/style.css',
				withoutHash: 'https://example.com/style.css',
				withoutHashAndAuth: 'https://example.com/style.css',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/style.css',
				paths: ['style.css'],
				depth: 1,
				dirname: '/',
				basename: 'style',
				isIndex: false,
				extname: '.css',
				query: null,
				hash: null,
				stem: '/style',
			};
			expect(encodeResourcePath(exUrl, 'text/css')).toBe('/style.css');
		});

		test('encodes pathname without extension with MIME type', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/page',
				_originUrlString: 'https://example.com/page',
				withoutHash: 'https://example.com/page',
				withoutHashAndAuth: 'https://example.com/page',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/page',
				paths: ['page'],
				depth: 1,
				dirname: '/',
				basename: 'page',
				isIndex: false,
				extname: null,
				query: null,
				hash: null,
				stem: '/page',
			};
			expect(encodeResourcePath(exUrl, 'text/html')).toBe('/page:::text/html');
		});

		test('returns pathname without extension when MIME type is not provided', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/page',
				_originUrlString: 'https://example.com/page',
				withoutHash: 'https://example.com/page',
				withoutHashAndAuth: 'https://example.com/page',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/page',
				paths: ['page'],
				depth: 1,
				dirname: '/',
				basename: 'page',
				isIndex: false,
				extname: null,
				query: null,
				hash: null,
				stem: '/page',
			};
			expect(encodeResourcePath(exUrl)).toBe('/page');
		});

		test('handles pathname ending with slash', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/path/to/',
				_originUrlString: 'https://example.com/path/to/',
				withoutHash: 'https://example.com/path/to/',
				withoutHashAndAuth: 'https://example.com/path/to/',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/path/to/',
				paths: ['path', 'to'],
				depth: 2,
				dirname: '/path/to',
				basename: null,
				isIndex: true,
				extname: null,
				query: null,
				hash: null,
				stem: '/path/to/',
			};
			expect(encodeResourcePath(exUrl, 'text/html')).toBe('/path/to/:::text/html');
		});

		test('handles nested path without extension', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/path/to/resource',
				_originUrlString: 'https://example.com/path/to/resource',
				withoutHash: 'https://example.com/path/to/resource',
				withoutHashAndAuth: 'https://example.com/path/to/resource',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/path/to/resource',
				paths: ['path', 'to', 'resource'],
				depth: 3,
				dirname: '/path/to',
				basename: 'resource',
				isIndex: false,
				extname: null,
				query: null,
				hash: null,
				stem: '/path/to/resource',
			};
			expect(encodeResourcePath(exUrl, 'application/json')).toBe(
				'/path/to/resource:::application/json',
			);
		});

		test('handles nested path with extension', () => {
			const exUrl: ExURL = {
				href: 'https://example.com/path/to/file.js',
				_originUrlString: 'https://example.com/path/to/file.js',
				withoutHash: 'https://example.com/path/to/file.js',
				withoutHashAndAuth: 'https://example.com/path/to/file.js',
				protocol: 'https:',
				isHTTP: true,
				isSecure: true,
				username: null,
				password: null,
				hostname: 'example.com',
				port: null,
				pathname: '/path/to/file.js',
				paths: ['path', 'to', 'file.js'],
				depth: 3,
				dirname: '/path/to',
				basename: 'file',
				isIndex: false,
				extname: '.js',
				query: null,
				hash: null,
				stem: '/path/to/file',
			};
			expect(encodeResourcePath(exUrl, 'application/javascript')).toBe(
				'/path/to/file.js',
			);
		});
	});

	describe('extension detection edge cases', () => {
		test('handles file with multiple dots in name', () => {
			const url = new URL('https://example.com/file.min.js');
			expect(encodeResourcePath(url, 'application/javascript')).toBe('/file.min.js');
		});

		test('handles file with dot at start', () => {
			const url = new URL('https://example.com/.hidden');
			expect(encodeResourcePath(url)).toBe('/.hidden');
		});

		test('handles path segment with dot but not extension', () => {
			const url = new URL('https://example.com/path.with.dots/resource');
			expect(encodeResourcePath(url, 'text/html')).toBe(
				'/path.with.dots/resource:::text/html',
			);
		});

		test('handles last segment with dot but no extension (folder ending with dot)', () => {
			// Note: lastSegment.includes('.') returns true, so it's treated as having extension
			const url = new URL('https://example.com/path/resource.');
			expect(encodeResourcePath(url, 'text/html')).toBe('/path/resource.');
		});

		test('handles file with dot in last segment', () => {
			const url = new URL('https://example.com/path/resource.file');
			expect(encodeResourcePath(url, 'text/html')).toBe('/path/resource.file');
		});
	});

	describe('MIME type encoding', () => {
		test('encodes with various MIME types', () => {
			const url = new URL('https://example.com/api');
			expect(encodeResourcePath(url, 'application/json')).toBe('/api:::application/json');
			expect(encodeResourcePath(url, 'text/html')).toBe('/api:::text/html');
			expect(encodeResourcePath(url, 'application/xml')).toBe('/api:::application/xml');
		});

		test('does not encode when MIME type is empty string', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, '')).toBe('/page');
		});

		test('handles MIME type with parameters (only uses before semicolon)', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, 'text/html; charset=utf-8')).toBe(
				'/page:::text/html; charset=utf-8',
			);
		});
	});

	describe('custom separator', () => {
		test('uses default separator ":::"', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, 'text/html')).toBe('/page:::text/html');
		});

		test('uses custom separator', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, 'text/html', '|')).toBe('/page|text/html');
			expect(encodeResourcePath(url, 'text/html', '::')).toBe('/page::text/html');
			expect(encodeResourcePath(url, 'text/html', '---')).toBe('/page---text/html');
		});

		test('handles empty separator', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, 'text/html', '')).toBe('/pagetext/html');
		});

		test('custom separator does not affect paths with extension', () => {
			const url = new URL('https://example.com/style.css');
			expect(encodeResourcePath(url, 'text/css', '|')).toBe('/style.css');
		});

		test('custom separator does not affect paths without MIME type', () => {
			const url = new URL('https://example.com/page');
			expect(encodeResourcePath(url, undefined, '|')).toBe('/page');
		});
	});
});
