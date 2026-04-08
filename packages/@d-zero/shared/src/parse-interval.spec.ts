import { describe, expect, it } from 'vitest';

import { parseInterval } from './parse-interval.js';

describe('parseInterval', () => {
	describe('with undefined or empty string', () => {
		it('should return undefined for undefined', () => {
			expect(parseInterval()).toBeUndefined();
		});

		it('should return undefined for empty string', () => {
			expect(parseInterval('')).toBeUndefined();
		});
	});

	describe('with number format', () => {
		it('should return a number for valid integer string', () => {
			expect(parseInterval('1000')).toBe(1000);
			expect(parseInterval('0')).toBe(0);
			expect(parseInterval('123')).toBe(123);
		});

		it('should parse decimal strings as integers', () => {
			expect(parseInterval('1000.5')).toBe(1000);
		});

		it('should throw error for negative numbers', () => {
			expect(() => parseInterval('-100')).toThrow('Interval must be non-negative');
		});

		it('should throw error for invalid number format', () => {
			expect(() => parseInterval('abc')).toThrow('Invalid interval format');
			expect(() => parseInterval('12.34.56')).toThrow('Invalid interval format');
		});
	});

	describe('with range format', () => {
		it('should return DelayOptions with random range for valid range', () => {
			const result = parseInterval('500-1000');
			expect(result).toEqual({ random: { min: 500, max: 1000 } });
		});

		it('should handle single digit ranges', () => {
			const result = parseInterval('5-10');
			expect(result).toEqual({ random: { min: 5, max: 10 } });
		});

		it('should handle large numbers', () => {
			const result = parseInterval('10000-50000');
			expect(result).toEqual({ random: { min: 10_000, max: 50_000 } });
		});

		it('should throw error when min equals max', () => {
			expect(() => parseInterval('100-100')).toThrow('min must be less than max');
		});

		it('should throw error when min is greater than max', () => {
			expect(() => parseInterval('1000-500')).toThrow('min must be less than max');
		});

		it('should throw error for invalid range format with multiple hyphens', () => {
			expect(() => parseInterval('100-200-300')).toThrow(
				'Invalid interval format: "100-200-300". Expected format: "number" or "min-max"',
			);
		});

		it('should throw error when min is not a number', () => {
			expect(() => parseInterval('abc-1000')).toThrow('Both min and max must be numbers');
		});

		it('should throw error when max is not a number', () => {
			expect(() => parseInterval('100-abc')).toThrow('Both min and max must be numbers');
		});

		it('should handle decimal values by parsing as integers', () => {
			const result = parseInterval('500.5-1000.7');
			expect(result).toEqual({ random: { min: 500, max: 1000 } });
		});
	});
});
