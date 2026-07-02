import { describe, expect, test } from 'vitest';

import { isNoiseClass } from './is-noise-class.js';
import { DEFAULT_NOISE_CLASS_PATTERNS } from './noise-class-patterns.js';

describe('isNoiseClass', () => {
	test.each([
		['_a1b2c3', true],
		['sc-bdVaJa', true],
		['css-1x2y3z', true],
		['chunk-a3f9c1', true],
		['k3j9zq2a', true],
		['card', false],
		['card--active', false],
		['footer', false],
		['current', false],
		// Real CamelCase/mixed-case words that happen to end in a digit must
		// not be caught by the generic alphanumeric-hash pattern, which is
		// deliberately case-sensitive (lowercase-only) for this reason.
		['Section1', false],
		['Banner99', false],
	])('%s -> %s', (className, expected) => {
		expect(isNoiseClass(className, DEFAULT_NOISE_CLASS_PATTERNS)).toBe(expected);
	});
});
