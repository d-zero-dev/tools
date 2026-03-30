import { describe, expect, it } from 'vitest';

import { randomInt } from './random-int.js';

describe('randomInt', () => {
	describe('with number argument', () => {
		it('should return a value between 0 (inclusive) and range (exclusive)', () => {
			const range = 100;
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				const result = randomInt(range);
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThan(range);
				expect(Number.isInteger(result)).toBe(true);
			}
		});

		it('should return 0 when range is 1', () => {
			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				expect(randomInt(1)).toBe(0);
			}
		});

		it('should produce different values over multiple calls', () => {
			const results = new Set<number>();
			const iterations = 1000;
			const range = 100;

			for (let i = 0; i < iterations; i++) {
				results.add(randomInt(range));
			}

			// With 1000 iterations and range of 100, we should see many different values
			expect(results.size).toBeGreaterThan(50);
		});

		it('should return 0 when range is 0', () => {
			expect(randomInt(0)).toBe(0);
		});

		it('should return 0 when range is negative', () => {
			expect(randomInt(-5)).toBe(0);
		});
	});

	describe('with {min, max} argument', () => {
		it('should return a value between min (inclusive) and max (exclusive)', () => {
			const min = 10;
			const max = 20;
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				const result = randomInt({ min, max });
				expect(result).toBeGreaterThanOrEqual(min);
				expect(result).toBeLessThan(max);
				expect(Number.isInteger(result)).toBe(true);
			}
		});

		it('should return min when min and max differ by 1', () => {
			const iterations = 100;
			for (let i = 0; i < iterations; i++) {
				expect(randomInt({ min: 5, max: 6 })).toBe(5);
			}
		});

		it('should produce different values over multiple calls', () => {
			const results = new Set<number>();
			const iterations = 1000;
			const min = 0;
			const max = 100;

			for (let i = 0; i < iterations; i++) {
				results.add(randomInt({ min, max }));
			}

			// With 1000 iterations and range of 100, we should see many different values
			expect(results.size).toBeGreaterThan(50);
		});

		it('should handle negative ranges', () => {
			const min = -50;
			const max = -10;
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				const result = randomInt({ min, max });
				expect(result).toBeGreaterThanOrEqual(min);
				expect(result).toBeLessThan(max);
				expect(Number.isInteger(result)).toBe(true);
			}
		});

		it('should return min when min equals max', () => {
			expect(randomInt({ min: 5, max: 5 })).toBe(5);
		});

		it('should return min when min is greater than max', () => {
			expect(randomInt({ min: 10, max: 5 })).toBe(10);
		});

		it('should handle ranges crossing zero', () => {
			const min = -10;
			const max = 10;
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				const result = randomInt({ min, max });
				expect(result).toBeGreaterThanOrEqual(min);
				expect(result).toBeLessThan(max);
				expect(Number.isInteger(result)).toBe(true);
			}
		});
	});
});
