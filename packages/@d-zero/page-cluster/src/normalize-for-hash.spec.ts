import { describe, expect, test } from 'vitest';

import { normalizeForHash } from './normalize-for-hash.js';

describe('normalizeForHash', () => {
	test('trims leading/trailing whitespace', () => {
		expect(normalizeForHash('  hello  ')).toBe('hello');
	});

	test('collapses runs of whitespace (including newlines) to a single space', () => {
		expect(normalizeForHash('var\n\n  a  =\r\n1;')).toBe('var a = 1;');
	});

	test('does not merge tokens separated by a single space', () => {
		expect(normalizeForHash('var a=1;')).toBe('var a=1;');
	});
});
