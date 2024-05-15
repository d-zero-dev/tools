import dayjs from 'dayjs';
import { describe, test, expect } from 'vitest';

import { skipHolydayPeriod } from './skip-holyday-period.js';

describe('skipHolydayPeriod', () => {
	test('2021-08-01 to 2021-08-03', () => {
		const start = dayjs('2021-08-01');
		const due = dayjs('2021-08-03');
		const { startDate, dueDate } = skipHolydayPeriod(start, due);
		expect(start.day()).toBe(0);
		expect(due.day()).toBe(2);
		expect(startDate.format('YYYY-MM-DD')).toBe('2021-08-02');
		expect(dueDate.format('YYYY-MM-DD')).toBe('2021-08-04');
		expect(startDate.day()).toBe(1);
		expect(dueDate.day()).toBe(3);
	});

	test('2021-08-01 to 2021-08-30', () => {
		const start = dayjs('2021-08-01');
		const due = dayjs('2021-08-30');
		const { startDate, dueDate } = skipHolydayPeriod(start, due);
		expect(start.day()).toBe(0);
		expect(due.day()).toBe(1);
		expect(startDate.format('YYYY-MM-DD')).toBe('2021-08-02');
		expect(dueDate.format('YYYY-MM-DD')).toBe('2021-09-10');
		expect(startDate.day()).toBe(1);
		expect(dueDate.day()).toBe(5);
	});

	test('2023-12-25 to 2024-01-03', () => {
		const start = dayjs('2023-12-25');
		const due = dayjs('2024-01-03');
		const { startDate, dueDate } = skipHolydayPeriod(start, due);
		expect(due.diff(start, 'day')).toBe(9);
		expect(start.day()).toBe(1);
		expect(due.day()).toBe(3);
		expect(startDate.format('YYYY-MM-DD')).toBe('2023-12-25');
		expect(dueDate.format('YYYY-MM-DD')).toBe('2024-01-09');
		expect(startDate.day()).toBe(1);
		expect(dueDate.day()).toBe(2);
	});
});
