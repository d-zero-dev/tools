import { describe, it, expect } from 'vitest';

import { parseUrl } from './parse-url.js';

describe('parseUrl', () => {
	it('parses a string URL into ExURL', () => {
		const result = parseUrl('https://example.com/path');
		expect(result).not.toBeNull();
		expect(result!.hostname).toBe('example.com');
	});

	it('returns ExURL object as-is when passed an ExURL', () => {
		const exUrl = parseUrl('https://example.com')!;
		const result = parseUrl(exUrl);
		expect(result).toBe(exUrl);
	});

	it('returns null for fragment-only string', () => {
		const result = parseUrl('#fragment');
		expect(result).toBeNull();
	});

	it('returns non-null for tel: URL (has protocol)', () => {
		const result = parseUrl('tel:000-0000-0000');
		// tel: URL has protocol set, so parseUrl does not filter it out
		expect(result).not.toBeNull();
		expect(result!.protocol).toBe('tel:');
	});

	it('parses http URL', () => {
		const result = parseUrl('http://example.com');
		expect(result).not.toBeNull();
		expect(result!.protocol).toBe('http:');
	});
});
