import dayjs from 'dayjs';
import { describe, test, expect } from 'vitest';

import { skipHolydays } from './skip-holydays.js';

describe('skipHolydays', () => {
	test('skip from Sunday', () => {
		const current = dayjs('2021-08-01');
		const skipped = skipHolydays(current);
		expect(current.day()).toBe(0);
		expect(skipped.format('YYYY-MM-DD')).toBe('2021-08-02');
		expect(skipped.day()).toBe(1);
	});

	test('skip from Sunday', () => {
		const current = dayjs('2022-01-01');
		const skipped = skipHolydays(current);
		expect(current.day()).toBe(6);
		expect(skipped.format('YYYY-MM-DD')).toBe('2022-01-03');
		expect(skipped.day()).toBe(1);
	});
});
