import { describe, expect, test } from 'vitest';

import { formatBracket } from './format-bracket.js';

describe('formatBracket', () => {
	test('returns empty string when all values are undefined', () => {
		expect(formatBracket({ role: undefined, type: undefined })).toBe('');
	});

	test('formats a single attribute', () => {
		expect(formatBracket({ role: 'button', type: undefined })).toBe('[role=button]');
	});

	test('sorts multiple attributes alphabetically by key=value', () => {
		expect(formatBracket({ type: 'checkbox', role: 'switch' })).toBe(
			'[role=switch,type=checkbox]',
		);
	});

	test('sorts role, sha, and type together', () => {
		expect(formatBracket({ role: 'img', sha: 'abcd1234ef567890', type: undefined })).toBe(
			'[role=img,sha=abcd1234ef567890]',
		);
	});
});
