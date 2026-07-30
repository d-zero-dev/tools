import { describe, expect, it } from 'vitest';

import { parseUrlList } from './parse-url-list.js';

describe('parseUrlList', () => {
	it('parses one URL per line', () => {
		expect(parseUrlList('https://a.example/\nhttps://b.example/')).toEqual([
			'https://a.example/',
			'https://b.example/',
		]);
	});

	it('ignores blank lines and comment lines', () => {
		const text = 'https://a.example/\n\n# a comment\nhttps://b.example/\n';
		expect(parseUrlList(text)).toEqual(['https://a.example/', 'https://b.example/']);
	});

	it('trims surrounding whitespace on each line', () => {
		expect(parseUrlList('  https://a.example/  \n')).toEqual(['https://a.example/']);
	});

	it('parses a JSON array of strings', () => {
		expect(parseUrlList('["https://a.example/", "https://b.example/"]', 'json')).toEqual([
			'https://a.example/',
			'https://b.example/',
		]);
	});

	it('throws on invalid JSON when format is json', () => {
		expect(() => parseUrlList('not json', 'json')).toThrow(/failed to parse/);
	});

	it('throws when JSON is not an array of strings', () => {
		expect(() => parseUrlList('{"a": 1}', 'json')).toThrow(/array of strings/);
		expect(() => parseUrlList('[1, 2]', 'json')).toThrow(/array of strings/);
	});
});
