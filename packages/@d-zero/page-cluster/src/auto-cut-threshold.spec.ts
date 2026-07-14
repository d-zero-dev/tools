import { describe, expect, test } from 'vitest';

import { autoCutThreshold } from './auto-cut-threshold.js';

describe('autoCutThreshold', () => {
	test('empty array returns upperBound', () => {
		expect(autoCutThreshold([], 0.8)).toBe(0.8);
	});

	test('single-element array returns upperBound', () => {
		expect(autoCutThreshold([0.5], 0.8)).toBe(0.8);
	});

	test('all-equal heights return upperBound (no gap to measure)', () => {
		expect(autoCutThreshold([0.5, 0.5, 0.5], 0.8)).toBe(0.8);
	});

	test('returns the midpoint of the largest gap', () => {
		// sorted [0.9, 0.1]: gap = 0.8, midpoint = (0.9 + 0.1) / 2 = 0.5
		expect(autoCutThreshold([0.9, 0.1], 0.8)).toBe(0.5);
	});

	test('clamps midpoint to upperBound when midpoint exceeds it', () => {
		// sorted [0.95, 0.85]: midpoint = 0.9, upperBound = 0.8 → clamped to 0.8
		expect(autoCutThreshold([0.95, 0.85], 0.8)).toBe(0.8);
	});

	test('returns midpoint unchanged when it is below upperBound', () => {
		// sorted [0.6, 0.2]: 0.6 + 0.2 === 0.8 (exact in IEEE 754), midpoint = 0.4
		expect(autoCutThreshold([0.6, 0.2], 0.8)).toBe(0.4);
	});

	test('selects the largest gap, not the first', () => {
		// sorted [0.9, 0.8, 0.2, 0.1]: gaps [0.1, 0.6, 0.1] — largest at index 1
		// midpoint = (0.8 + 0.2) / 2 = 0.5
		expect(autoCutThreshold([0.9, 0.8, 0.2, 0.1], 0.8)).toBe(0.5);
	});
});
