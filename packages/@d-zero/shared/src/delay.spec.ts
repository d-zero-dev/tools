import { describe, expect, it } from 'vitest';

import { delay } from './delay.js';

describe('delay', () => {
	describe('with number argument', () => {
		it('should delay for the specified duration', async () => {
			const ms = 10;
			const start = Date.now();
			await delay(ms);
			const elapsed = Date.now() - start;

			// Allow some tolerance for timing precision
			expect(elapsed).toBeGreaterThanOrEqual(ms - 5);
			expect(elapsed).toBeLessThan(ms + 50);
		});

		it('should return a Promise<void>', async () => {
			const result = delay(1);
			expect(result).toBeInstanceOf(Promise);
			const resolved = await result;
			expect(resolved).toBeUndefined();
		});
	});

	describe('with DelayOptions argument', () => {
		it('should delay with random number range', async () => {
			const maxMs = 50;
			const start = Date.now();
			await delay({ random: maxMs });
			const elapsed = Date.now() - start;

			// Should be within the range (with some tolerance)
			expect(elapsed).toBeGreaterThanOrEqual(0);
			expect(elapsed).toBeLessThan(maxMs + 50);
		});

		it('should delay with random {min, max} range', async () => {
			const min = 10;
			const max = 50;
			const start = Date.now();
			await delay({ random: { min, max } });
			const elapsed = Date.now() - start;

			// Should be within the range (with some tolerance)
			expect(elapsed).toBeGreaterThanOrEqual(min - 5);
			expect(elapsed).toBeLessThan(max + 50);
		});

		it('should return a Promise<void>', async () => {
			const result = delay({ random: 10 });
			expect(result).toBeInstanceOf(Promise);
			const resolved = await result;
			expect(resolved).toBeUndefined();
		});
	});
});
