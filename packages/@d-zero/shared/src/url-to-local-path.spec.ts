import { describe, expect, test } from 'vitest';

import { urlToLocalPath } from './url-to-local-path.js';

describe('urlToLocalPath', () => {
	test('converts root URL to index with extension', () => {
		expect(urlToLocalPath('https://example.com/', '.html')).toBe('index.html');
		expect(urlToLocalPath('https://example.com', '.html')).toBe('index.html');
	});

	test('converts directory URL to index with extension', () => {
		expect(urlToLocalPath('https://example.com/path/', '.html')).toBe('path/index.html');
		expect(urlToLocalPath('https://example.com/a/b/', '.html')).toBe('a/b/index.html');
	});

	test('adds extension to file without extension', () => {
		expect(urlToLocalPath('https://example.com/file', '.html')).toBe('file.html');
		expect(urlToLocalPath('https://example.com/path/to/file', '.json')).toBe(
			'path/to/file.json',
		);
	});

	test('keeps existing extension', () => {
		expect(urlToLocalPath('https://example.com/file.js', '')).toBe('file.js');
		expect(urlToLocalPath('https://example.com/style.css', '')).toBe('style.css');
		expect(urlToLocalPath('https://example.com/path/to/script.js', '.html')).toBe(
			'path/to/script.js',
		);
	});

	test('handles empty extension', () => {
		expect(urlToLocalPath('https://example.com/', '')).toBe('index');
		expect(urlToLocalPath('https://example.com/path/', '')).toBe('path/index');
		expect(urlToLocalPath('https://example.com/file', '')).toBe('file');
	});

	test('handles URL with query parameters', () => {
		expect(urlToLocalPath('https://example.com/?query=value', '.html')).toBe(
			'index.html',
		);
		expect(urlToLocalPath('https://example.com/page?id=123', '.html')).toBe('page.html');
	});

	test('handles URL with hash', () => {
		expect(urlToLocalPath('https://example.com/#section', '.html')).toBe('index.html');
		expect(urlToLocalPath('https://example.com/page#top', '.html')).toBe('page.html');
	});

	test('handles URL with port', () => {
		expect(urlToLocalPath('https://example.com:8080/', '.html')).toBe('index.html');
		expect(urlToLocalPath('https://example.com:8080/file', '.html')).toBe('file.html');
	});

	test('removes leading slash from pathname', () => {
		expect(urlToLocalPath('https://example.com/path/file.js', '')).toBe('path/file.js');
		expect(urlToLocalPath('https://example.com/file', '.html')).toBe('file.html');
	});

	test('handles nested paths', () => {
		expect(urlToLocalPath('https://example.com/a/b/c/', '.html')).toBe(
			'a/b/c/index.html',
		);
		expect(urlToLocalPath('https://example.com/a/b/c', '.html')).toBe('a/b/c.html');
		expect(urlToLocalPath('https://example.com/a/b/c.js', '')).toBe('a/b/c.js');
	});

	test('handles files with multiple dots', () => {
		expect(urlToLocalPath('https://example.com/file.min.js', '')).toBe('file.min.js');
		expect(urlToLocalPath('https://example.com/package.json', '')).toBe('package.json');
	});
});
