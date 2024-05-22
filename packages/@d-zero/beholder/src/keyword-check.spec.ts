import { test, expect } from 'vitest';

import { keywordCheck } from './keyword-check.js';

test('keyword checking', () => {
	expect(keywordCheck('abc', ['abc'])).toBe('abc');
	expect(keywordCheck('ABC', ['abc', '/abc/i'])).toBe('/abc/i');
});
