import { describe, expect, it } from 'vitest';

import { sampleDistribution } from './sample-distribution.js';

describe('sampleDistribution', () => {
	describe('uniform distribution (default)', () => {
		it('should use uniform distribution when not specified', () => {
			const min = 100;
			const max = 200;
			const value = sampleDistribution({ min, max });

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		});

		it('should use uniform distribution when explicitly specified', () => {
			const min = 100;
			const max = 200;
			const value = sampleDistribution({ min, max }, 'uniform');

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		});

		it('should handle edge case where min equals max', () => {
			const min = 100;
			const max = 100;
			const value = sampleDistribution({ min, max });

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});

		it('should handle very large range', () => {
			const min = 0;
			const max = Number.MAX_SAFE_INTEGER;
			const value = sampleDistribution({ min, max });

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		});
	});

	describe('normal distribution', () => {
		it('should generate values within range', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, 'normal');
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const value = sampleDistribution({ min, max }, 'normal');

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});
	});

	describe('triangular distribution', () => {
		it('should generate values within range', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, 'triangular');
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const value = sampleDistribution({ min, max }, 'triangular');

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});
	});

	describe('bimodal distribution', () => {
		it('should generate values within range with default peaks', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, { type: 'bimodal' });
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should generate values within range with custom peaks', () => {
			const min = 100;
			const max = 1000;
			const peaks: [number, number] = [0.2, 0.8];
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, { type: 'bimodal', peaks });
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const value = sampleDistribution({ min, max }, { type: 'bimodal' });

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});

		it('should handle peaks at boundaries', () => {
			const min = 100;
			const max = 1000;
			const peaks: [number, number] = [0, 1];
			const value = sampleDistribution({ min, max }, { type: 'bimodal', peaks });

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		});
	});

	describe('right-skewed distribution', () => {
		it('should generate values within range', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, 'right-skewed');
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const value = sampleDistribution({ min, max }, 'right-skewed');

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});
	});

	describe('left-skewed distribution', () => {
		it('should generate values within range', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution({ min, max }, 'left-skewed');
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const value = sampleDistribution({ min, max }, 'left-skewed');

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});
	});

	describe('custom distribution', () => {
		it('should generate values within range with custom weight function', () => {
			const min = 100;
			const max = 1000;
			const samples = 100;
			const values: number[] = [];

			// Custom weight function: quadratic (t^2)
			const customWeight = (t: number) => t * t;

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution(
					{ min, max },
					{ type: 'custom', weight: customWeight },
				);
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		});

		it('should handle edge case where min equals max', () => {
			const min = 500;
			const max = 500;
			const customWeight = (t: number) => t * t;
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});

		it('should handle constant weight function', () => {
			const min = 100;
			const max = 1000;
			const customWeight = () => 1;
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		});

		it('should handle zero weight function (should not throw)', () => {
			const min = 100;
			const max = 1000;
			const customWeight = () => 0;
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});

		it('should complete within reasonable time for large range', () => {
			const min = 0;
			const max = 1_000_000;
			const customWeight = (t: number) => Math.sin(t * Math.PI) + 1;
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		}, 5000);

		it('should complete within reasonable time for complex weight function', () => {
			const min = 100;
			const max = 10_000;
			// Complex weight function that requires numerical integration
			const customWeight = (t: number) =>
				Math.sin(t * Math.PI * 10) * Math.cos(t * Math.PI * 5) + 2;
			const samples = 10;
			const values: number[] = [];

			for (let i = 0; i < samples; i++) {
				const value = sampleDistribution(
					{ min, max },
					{ type: 'custom', weight: customWeight },
				);
				values.push(value);
			}

			for (const value of values) {
				expect(value).toBeGreaterThanOrEqual(min);
				expect(value).toBeLessThan(max);
			}
		}, 10_000);

		it('should handle weight function returning NaN gracefully', () => {
			const min = 100;
			const max = 1000;
			const customWeight = () => Number.NaN;
			// Should not throw, but may return unexpected result
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			// Result may be NaN or a valid number, but should not crash
			expect(typeof value).toBe('number');
		});

		it('should handle weight function returning Infinity gracefully', () => {
			const min = 100;
			const max = 1000;
			const customWeight = () => Infinity;
			// Should not throw, but may return unexpected result
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			// Result may be Infinity or a valid number, but should not crash
			expect(typeof value).toBe('number');
		});

		it('should handle weight function returning negative values', () => {
			const min = 100;
			const max = 1000;
			const customWeight = (t: number) => -t;
			// Should not throw, but treats negative as zero
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max + 1);
		});

		it('should handle extremely large range without timeout', () => {
			const min = 0;
			const max = 100_000_000; // 100 million
			const customWeight = (t: number) => t * t;
			const value = sampleDistribution(
				{ min, max },
				{ type: 'custom', weight: customWeight },
			);

			expect(value).toBeGreaterThanOrEqual(min);
			expect(value).toBeLessThan(max);
		}, 5000);
	});
});
