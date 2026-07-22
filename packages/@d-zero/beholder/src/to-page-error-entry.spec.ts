import { describe, expect, it } from 'vitest';

import { toPageErrorEntry } from './to-page-error-entry.js';

describe('toPageErrorEntry', () => {
	it('extracts message and stack from an Error', () => {
		const error = new Error('boom');
		const entry = toPageErrorEntry(error, 'https://example.com/');

		expect(entry.pageUrl).toBe('https://example.com/');
		expect(entry.type).toBe('pageerror');
		expect(entry.text).toBe('boom');
		expect(entry.stack).toBe(error.stack);
		expect(entry.args).toEqual([]);
	});

	it('stringifies a non-Error throw value and omits stack', () => {
		const entry = toPageErrorEntry('oops', 'https://example.com/');

		expect(entry.text).toBe('oops');
		expect(entry.stack).toBeUndefined();
	});
});
