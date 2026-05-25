import { describe, expect, it } from 'vitest';

import { resolveValue } from './resolve-value.js';

describe('resolveValue', () => {
	it('数値を渡したらそのまま返す', () => {
		expect(resolveValue(100)).toBe(100);
		expect(resolveValue(0)).toBe(0);
		expect(resolveValue(1)).toBe(1);
	});

	it('{ random: number } を渡したら 0 以上 n 未満の整数を返す', () => {
		for (let i = 0; i < 200; i++) {
			const v = resolveValue({ random: 100 });
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(100);
			expect(Number.isInteger(v)).toBe(true);
		}
	});

	it('{ random: { min, max } } を渡したら [min, max) の整数を返す', () => {
		for (let i = 0; i < 200; i++) {
			const v = resolveValue({ random: { min: 50, max: 100 } });
			expect(v).toBeGreaterThanOrEqual(50);
			expect(v).toBeLessThan(100);
			expect(Number.isInteger(v)).toBe(true);
		}
	});

	it('min === max のときは min を返す', () => {
		expect(resolveValue({ random: { min: 42, max: 42 } })).toBe(42);
	});

	it('distribution: uniform を明示しても [min, max) の整数を返す', () => {
		for (let i = 0; i < 100; i++) {
			const v = resolveValue({
				random: { min: 200, max: 500, distribution: 'uniform' },
			});
			expect(v).toBeGreaterThanOrEqual(200);
			expect(v).toBeLessThan(500);
		}
	});
});
