import { describe, it, expect } from 'vitest';

import { keywordCheck } from './keyword-check.js';

describe('keywordCheck', () => {
	it('returns the matched keyword when found', () => {
		expect(keywordCheck('<html><body>error message</body></html>', ['error'])).toBe(
			'error',
		);
	});

	it('returns false when no keyword matches', () => {
		expect(keywordCheck('<html><body>hello world</body></html>', ['error'])).toBe(false);
	});

	it('returns the first matching keyword when multiple match', () => {
		expect(
			keywordCheck('<html><body>error warning</body></html>', ['warning', 'error']),
		).toBe('warning');
	});

	it('returns false for empty keyword array', () => {
		expect(keywordCheck('<html><body>some content</body></html>', [])).toBe(false);
	});

	it('returns false for empty HTML', () => {
		expect(keywordCheck('', ['error'])).toBe(false);
	});

	it('supports regex pattern with /pattern/ syntax', () => {
		expect(keywordCheck('<html><body>code 404 found</body></html>', ['/\\d{3}/'])).toBe(
			'/\\d{3}/',
		);
	});

	it('is case-sensitive by default for plain keywords', () => {
		expect(keywordCheck('<html><body>Error</body></html>', ['error'])).toBe(false);
	});

	it('supports case-insensitive flag /pattern/i', () => {
		expect(keywordCheck('<html><body>Error</body></html>', ['/error/i'])).toBe(
			'/error/i',
		);
	});

	it('returns false when regex pattern does not match', () => {
		expect(keywordCheck('<html><body>no numbers</body></html>', ['/\\d+/'])).toBe(false);
	});
});
