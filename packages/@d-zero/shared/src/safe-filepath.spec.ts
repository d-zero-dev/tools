import { describe, it, expect } from 'vitest';

import { safeFilePath } from './safe-filepath.js';

describe('safeFilePath', () => {
	it('returns normal filename as-is', () => {
		expect(safeFilePath('hello.txt')).toBe('hello.txt');
	});

	it('decodes URI-encoded Japanese characters', () => {
		expect(safeFilePath('%E3%83%86%E3%82%B9%E3%83%88.html')).toBe('テスト.html');
	});

	it('replaces special characters with underscore', () => {
		const result = safeFilePath('file<name>.txt');
		expect(result).not.toContain('<');
		expect(result).not.toContain('>');
	});

	it('handles empty string', () => {
		expect(safeFilePath('')).toBe('');
	});

	it('handles double-encoded URI', () => {
		// %25E3%2583%2586 is double-encoded テ → decodeURI decodes only the outer layer
		const result = safeFilePath('%25E3%2583%2586');
		expect(result).toBe('%E3%83%86');
	});

	it('handles path with slashes (sanitize-filename removes them)', () => {
		const result = safeFilePath('path/to/file.txt');
		expect(result).not.toContain('/');
	});

	it('handles filename with spaces', () => {
		expect(safeFilePath('my%20file.txt')).toBe('my file.txt');
	});
});
