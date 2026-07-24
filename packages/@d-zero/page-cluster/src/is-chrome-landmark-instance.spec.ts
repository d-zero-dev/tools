import { describe, expect, test } from 'vitest';

import { isChromeLandmarkInstance } from './is-chrome-landmark-instance.js';

describe('isChromeLandmarkInstance', () => {
	test('an instance with zero tokens is never chrome', () => {
		expect(isChromeLandmarkInstance(new Set(), new Set(['a', 'b']))).toBe(false);
	});

	test('an instance fully covered by shell tokens is chrome', () => {
		expect(isChromeLandmarkInstance(new Set(['a', 'b']), new Set(['a', 'b', 'c']))).toBe(
			true,
		);
	});

	test('an instance with no overlap with shell tokens is not chrome', () => {
		expect(isChromeLandmarkInstance(new Set(['x', 'y']), new Set(['a', 'b']))).toBe(
			false,
		);
	});

	test('an instance right at the default 0.8 threshold is chrome', () => {
		// 4 of 5 tokens are shell tokens: 4/5 = 0.8, meets the default clamp.
		const instanceTokens = new Set(['a', 'b', 'c', 'd', 'x']);
		const shellTokens = new Set(['a', 'b', 'c', 'd']);
		expect(isChromeLandmarkInstance(instanceTokens, shellTokens)).toBe(true);
	});

	test('an instance just below the default 0.8 threshold is not chrome', () => {
		// 3 of 4 tokens are shell tokens: 3/4 = 0.75, below the default clamp.
		const instanceTokens = new Set(['a', 'b', 'c', 'x']);
		const shellTokens = new Set(['a', 'b', 'c']);
		expect(isChromeLandmarkInstance(instanceTokens, shellTokens)).toBe(false);
	});

	test('a custom threshold overrides the default', () => {
		// 1 of 2 tokens overlap: 0.5 ratio.
		const instanceTokens = new Set(['a', 'x']);
		const shellTokens = new Set(['a']);
		expect(isChromeLandmarkInstance(instanceTokens, shellTokens, 0.5)).toBe(true);
		expect(isChromeLandmarkInstance(instanceTokens, shellTokens, 0.6)).toBe(false);
	});
});
