import { type MockInstance, afterEach, describe, expect, it, vi } from 'vitest';

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

	describe('boundary values with mocked Math.random', () => {
		let randomSpy: MockInstance;

		afterEach(() => {
			randomSpy.mockRestore();
		});

		it('should not return max when Math.random returns near 1 (right-skewed)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999_999_999_9);
			const value = sampleDistribution({ min: 100, max: 1000 }, 'right-skewed');
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should not return max when Math.random returns near 1 (left-skewed)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999_999_999_9);
			const value = sampleDistribution({ min: 100, max: 1000 }, 'left-skewed');
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should not return max when Math.random returns near 1 (triangular)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999_999_999_9);
			const value = sampleDistribution({ min: 100, max: 1000 }, 'triangular');
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should not return max when Math.random returns near 1 (normal)', () => {
			// Box-Muller needs two random calls
			let callCount = 0;
			randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
				callCount++;
				return callCount === 1 ? 0.999_999_999_9 : 0.999_999_999_9;
			});
			const value = sampleDistribution({ min: 100, max: 1000 }, 'normal');
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should not return max when Math.random returns near 1 (custom)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999_999_999_9);
			const value = sampleDistribution(
				{ min: 100, max: 1000 },
				{ type: 'custom', weight: (t: number) => t },
			);
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should not return max when Math.random returns near 1 (bimodal)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999_999_999_9);
			const value = sampleDistribution({ min: 100, max: 1000 }, { type: 'bimodal' });
			expect(value).toBeGreaterThanOrEqual(100);
			expect(value).toBeLessThan(1000);
		});

		it('should return min when Math.random returns 0 (right-skewed)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
			const value = sampleDistribution({ min: 100, max: 1000 }, 'right-skewed');
			expect(value).toBe(100);
		});

		it('should return min when Math.random returns 0 (left-skewed)', () => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
			const value = sampleDistribution({ min: 100, max: 1000 }, 'left-skewed');
			expect(value).toBe(100);
		});
	});

	describe('range of 1 (min + 1 === max)', () => {
		it('should always return min for uniform', () => {
			const value = sampleDistribution({ min: 5, max: 6 });
			expect(value).toBe(5);
		});

		it('should always return min for normal', () => {
			const value = sampleDistribution({ min: 5, max: 6 }, 'normal');
			expect(value).toBe(5);
		});

		it('should always return min for triangular', () => {
			const value = sampleDistribution({ min: 5, max: 6 }, 'triangular');
			expect(value).toBe(5);
		});

		it('should always return min for right-skewed', () => {
			const value = sampleDistribution({ min: 5, max: 6 }, 'right-skewed');
			expect(value).toBe(5);
		});

		it('should always return min for left-skewed', () => {
			const value = sampleDistribution({ min: 5, max: 6 }, 'left-skewed');
			expect(value).toBe(5);
		});

		it('should always return min for bimodal', () => {
			const value = sampleDistribution({ min: 5, max: 6 }, { type: 'bimodal' });
			expect(value).toBe(5);
		});

		it('should always return min for custom', () => {
			const value = sampleDistribution(
				{ min: 5, max: 6 },
				{ type: 'custom', weight: (t: number) => t },
			);
			expect(value).toBe(5);
		});
	});

	describe('number type range with non-uniform distribution', () => {
		it('should work with number range and normal distribution', () => {
			const value = sampleDistribution(10, 'normal');
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(10);
		});

		it('should work with number range and right-skewed distribution', () => {
			const value = sampleDistribution(10, 'right-skewed');
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(10);
		});

		it('should return 0 for number range 0 with any distribution', () => {
			expect(sampleDistribution(0, 'normal')).toBe(0);
			expect(sampleDistribution(0, 'triangular')).toBe(0);
			expect(sampleDistribution(0, 'right-skewed')).toBe(0);
			expect(sampleDistribution(0, 'left-skewed')).toBe(0);
		});

		it('should return 0 for number range 1 with any distribution', () => {
			expect(sampleDistribution(1, 'normal')).toBe(0);
			expect(sampleDistribution(1, 'triangular')).toBe(0);
			expect(sampleDistribution(1, 'right-skewed')).toBe(0);
			expect(sampleDistribution(1, 'left-skewed')).toBe(0);
		});
	});
});
