import { describe, expect, test } from 'vitest';

import { validateSameHost } from './validate-same-host.js';

describe('validateSameHost', () => {
	test('returns hostname for single URL', () => {
		expect(validateSameHost(['https://example.com/'])).toBe('example.com');
		expect(validateSameHost(['https://example.com/path'])).toBe('example.com');
	});

	test('returns hostname for multiple URLs with same host', () => {
		expect(validateSameHost(['https://example.com/', 'https://example.com/page'])).toBe(
			'example.com',
		);
		expect(
			validateSameHost([
				'https://example.com/',
				'https://example.com/a',
				'https://example.com/b',
			]),
		).toBe('example.com');
	});

	test('handles URLs with different paths but same host', () => {
		expect(
			validateSameHost([
				'https://example.com/',
				'https://example.com/path/to/page',
				'https://example.com/another/path',
			]),
		).toBe('example.com');
	});

	test('handles URLs with query parameters', () => {
		expect(
			validateSameHost(['https://example.com/?query=1', 'https://example.com/page?id=2']),
		).toBe('example.com');
	});

	test('handles URLs with hash', () => {
		expect(
			validateSameHost(['https://example.com/#section', 'https://example.com/page#top']),
		).toBe('example.com');
	});

	test('handles URLs with port', () => {
		expect(
			validateSameHost(['https://example.com:8080/', 'https://example.com:8080/page']),
		).toBe('example.com');
	});

	test('throws error for empty URL list', () => {
		expect(() => validateSameHost([])).toThrow('URL list is empty');
	});

	test('throws error for URLs with different hosts', () => {
		expect(() =>
			validateSameHost(['https://example.com/', 'https://another.com/']),
		).toThrow('Multiple hosts detected: "example.com" and "another.com"');
	});

	test('throws error for multiple different hosts', () => {
		expect(() =>
			validateSameHost([
				'https://example.com/',
				'https://example.com/page',
				'https://another.com/',
			]),
		).toThrow('Multiple hosts detected: "example.com" and "another.com"');
	});

	test('throws error for invalid URL', () => {
		expect(() => validateSameHost(['not-a-url'])).toThrow('Invalid URL');
	});

	test('handles subdomains as different hosts', () => {
		expect(() =>
			validateSameHost(['https://www.example.com/', 'https://api.example.com/']),
		).toThrow('Multiple hosts detected: "www.example.com" and "api.example.com"');
	});

	test('handles URLs with different protocols but same host', () => {
		// Note: Different protocols (http vs https) still have the same hostname
		expect(validateSameHost(['http://example.com/', 'http://example.com/page'])).toBe(
			'example.com',
		);
	});
});
