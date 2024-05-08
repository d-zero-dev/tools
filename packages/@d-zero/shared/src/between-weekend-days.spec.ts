import { describe, test, expect } from 'vitest';

import { betweenWeekendDays } from './between-weekend-days.js';

describe('betweenWeekendDays', () => {
	test('2022-01', () => {
		expect(
			betweenWeekendDays(new Date('2022-01-01'), new Date('2022-01-03')).length,
		).toBe(2);
		expect(
			betweenWeekendDays(new Date('2022-01-01'), new Date('2022-01-31')).length,
		).toBe(10);
	});

	test('2023-09', () => {
		expect(
			betweenWeekendDays(new Date('2023-09-01'), new Date('2023-09-03')).length,
		).toBe(2);
		expect(
			betweenWeekendDays(new Date('2023-09-01'), new Date('2023-09-30')).length,
		).toBe(9);
	});
});
