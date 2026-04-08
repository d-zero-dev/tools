import { describe, it, expect } from 'vitest';

import { updateRatio, type RatioValue } from './ratio-value.js';

describe('updateRatio', () => {
	const createBaseObject = (): RatioValue => ({
		absNumber: 100,
		maxAbsNumber: 200,
		relNumber: 0.5,
		maxRelNumber: 1,
	});

	describe('absNumber updates', () => {
		it('should update absNumber and recalculate relNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'absNumber', 50);

			expect(result.absNumber).toBe(50);
			expect(result.relNumber).toBe(0.25);
			expect(result.maxAbsNumber).toBe(200);
		});

		it('should maintain invariant: absNumber / maxAbsNumber === relNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'absNumber', 150);

			expect(result.absNumber / result.maxAbsNumber).toBe(result.relNumber);
			expect(result.relNumber).toBe(0.75);
		});

		it('should handle zero absNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'absNumber', 0);

			expect(result.absNumber).toBe(0);
			expect(result.relNumber).toBe(0);
		});
	});

	describe('relNumber updates', () => {
		it('should update relNumber and recalculate absNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'relNumber', 0.25);

			expect(result.relNumber).toBe(0.25);
			expect(result.absNumber).toBe(50);
			expect(result.maxAbsNumber).toBe(200);
		});

		it('should maintain invariant: absNumber / maxAbsNumber === relNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'relNumber', 0.75);

			expect(result.absNumber / result.maxAbsNumber).toBe(result.relNumber);
			expect(result.absNumber).toBe(150);
		});

		it('should handle zero relNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'relNumber', 0);

			expect(result.relNumber).toBe(0);
			expect(result.absNumber).toBe(0);
		});

		it('should handle relNumber = 1', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'relNumber', 1);

			expect(result.relNumber).toBe(1);
			expect(result.absNumber).toBe(200);
		});
	});

	describe('maxAbsNumber updates', () => {
		it('should update maxAbsNumber and recalculate absNumber', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'maxAbsNumber', 400);

			expect(result.maxAbsNumber).toBe(400);
			expect(result.absNumber).toBe(200); // 0.5 * 400
			expect(result.relNumber).toBe(0.5);
		});

		it('should maintain invariant after maxAbsNumber change', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'maxAbsNumber', 300);

			expect(result.absNumber / result.maxAbsNumber).toBe(result.relNumber);
			expect(result.absNumber).toBe(150); // 0.5 * 300
		});
	});

	describe('immutability', () => {
		it('should not modify the original object', () => {
			const obj = createBaseObject();
			const original = { ...obj };

			updateRatio(obj, 'absNumber', 150);

			expect(obj).toEqual(original);
		});

		it('should return a new object', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'absNumber', 150);

			expect(result).not.toBe(obj);
		});
	});

	describe('edge cases', () => {
		it('should handle very small relNumber values', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'relNumber', 0.001);

			expect(result.relNumber).toBe(0.001);
			expect(result.absNumber).toBe(0.2);
		});

		it('should handle large maxAbsNumber values', () => {
			const obj = createBaseObject();
			const result = updateRatio(obj, 'maxAbsNumber', 10_000);

			expect(result.maxAbsNumber).toBe(10_000);
			expect(result.absNumber).toBe(5000); // 0.5 * 10000
		});
	});
});
