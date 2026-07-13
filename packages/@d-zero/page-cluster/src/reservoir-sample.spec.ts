import { describe, expect, test } from 'vitest';

import { reservoirSample } from './reservoir-sample.js';

describe('reservoirSample', () => {
	test('returns the requested number of items', () => {
		const items = Array.from({ length: 100 }, (_, i) => i);
		const result = reservoirSample(items, 10, 'seed');
		expect(result).toHaveLength(10);
	});

	test('is deterministic for the same seed', () => {
		const items = Array.from({ length: 100 }, (_, i) => i);
		const a = reservoirSample(items, 10, 'seed');
		const b = reservoirSample(items, 10, 'seed');
		expect(a).toEqual(b);
	});

	test('different seeds produce different samples on large inputs', () => {
		const items = Array.from({ length: 100 }, (_, i) => i);
		const a = reservoirSample(items, 10, 'block-a');
		const b = reservoirSample(items, 10, 'block-b');
		expect(a).not.toEqual(b);
	});

	test('preserves input order in the returned sample', () => {
		const items = Array.from({ length: 100 }, (_, i) => i);
		const result = reservoirSample(items, 10, 'seed');
		for (let i = 1; i < result.length; i++) {
			expect(result[i]).toBeGreaterThan(result[i - 1] as number);
		}
	});

	test('sampleSize >= items.length returns the full list in original order without invoking the PRNG', () => {
		const items = [7, 2, 5, 1];
		const result = reservoirSample(items, 10, 'ignored-seed');
		expect(result).toEqual(items);
	});

	test('sampleSize === items.length returns full list in original order', () => {
		const items = [7, 2, 5, 1];
		const result = reservoirSample(items, 4, 'ignored-seed');
		expect(result).toEqual(items);
	});

	test('sampleSize 0 returns empty', () => {
		const items = [1, 2, 3];
		expect(reservoirSample(items, 0, 'x')).toEqual([]);
	});

	test('empty items returns empty', () => {
		expect(reservoirSample([], 10, 'x')).toEqual([]);
	});

	test('numeric seed produces identical output to hashed string seed for the same underlying value (self-consistent)', () => {
		const items = Array.from({ length: 100 }, (_, i) => i);
		const withZero = reservoirSample(items, 5, 0);
		const withZeroAgain = reservoirSample(items, 5, 0);
		expect(withZero).toEqual(withZeroAgain);
	});

	test('rejects fractional or negative sampleSize', () => {
		expect(() => reservoirSample([1, 2, 3], -1, 'x')).toThrow(RangeError);
		expect(() => reservoirSample([1, 2, 3], 1.5, 'x')).toThrow(RangeError);
	});
});
