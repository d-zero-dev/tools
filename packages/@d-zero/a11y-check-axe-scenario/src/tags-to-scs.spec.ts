import { test, expect } from 'vitest';

import { tagToSC } from './tags-to-scs.js';

test('tagToSC', () => {
	expect(tagToSC('wcag')).toBe(null);
	expect(tagToSC('wcag2a')).toBe(null);
	expect(tagToSC('wcag2')).toBe(null);
	expect(tagToSC('wcag111')).toBe('1.1.1');
});
