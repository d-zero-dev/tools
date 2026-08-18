import { test, expect } from 'vitest';

import { formatElapsed } from './format-elapsed.js';

test('formats whole seconds with one decimal place', () => {
	expect(formatElapsed(3000)).toBe('(3.0s)');
});

test('formats sub-second durations rounded to one decimal place', () => {
	expect(formatElapsed(3400)).toBe('(3.4s)');
});

test('formats zero elapsed time', () => {
	expect(formatElapsed(0)).toBe('(0.0s)');
});
