import { test, expect } from 'vitest';

import { describeCause } from './describe-cause.js';

test('returns the message of an Error instance', () => {
	expect(describeCause(new Error('boom'))).toBe('boom');
});

test('stringifies a non-Error thrown value', () => {
	expect(describeCause('boom')).toBe('boom');
});
