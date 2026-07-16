import { describe, expect, it } from 'vitest';

import { isHtmlContentType } from './is-html-content-type.js';

describe('isHtmlContentType', () => {
	it('accepts text/html in any letter case and with surrounding whitespace', () => {
		expect(isHtmlContentType('text/html')).toBe(true);
		expect(isHtmlContentType('Text/HTML')).toBe(true);
		expect(isHtmlContentType(' text/html ')).toBe(true);
	});

	it('rejects non-HTML and null', () => {
		expect(isHtmlContentType('application/pdf')).toBe(false);
		expect(isHtmlContentType('text/plain')).toBe(false);
		expect(isHtmlContentType(null)).toBe(false);
	});
});
