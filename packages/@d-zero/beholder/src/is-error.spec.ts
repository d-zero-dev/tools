import { describe, it, expect } from 'vitest';

import { isError } from './is-error.js';

describe('isError', () => {
	it('returns true for status below 200', () => {
		expect(isError(199)).toBe(true);
	});

	it('returns false for status 200 (lower boundary)', () => {
		expect(isError(200)).toBe(false);
	});

	it('returns false for status 399 (upper boundary)', () => {
		expect(isError(399)).toBe(false);
	});

	it('returns true for status 400', () => {
		expect(isError(400)).toBe(true);
	});

	it('returns true for status 0', () => {
		expect(isError(0)).toBe(true);
	});

	it('returns true for negative status', () => {
		expect(isError(-1)).toBe(true);
	});

	it('returns true for status 500', () => {
		expect(isError(500)).toBe(true);
	});
});
