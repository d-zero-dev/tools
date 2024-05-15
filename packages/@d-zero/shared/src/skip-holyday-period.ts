import type dayjs from 'dayjs';

import holiday_jp from '@holiday-jp/holiday_jp';

import { betweenWeekendDays } from './between-weekend-days.js';
import { skipHolydays } from './skip-holydays.js';

/**
 * Skips the holiday period between the start and due dates.
 *
 * @param start The start date.
 * @param due The due date.
 * @returns An object containing the updated start and due dates.
 */
export function skipHolydayPeriod(start: dayjs.Dayjs, due: dayjs.Dayjs) {
	let startDate = start.clone();
	const period = due.diff(startDate, 'day');

	startDate = skipHolydays(startDate);
	let dueDate = startDate.add(period, 'day');

	const weekendDays = betweenWeekendDays(startDate.toDate(), dueDate.toDate());
	if (weekendDays.length > 0) {
		dueDate = dueDate.add(weekendDays.length, 'day');
		dueDate = skipHolydays(dueDate);
	}

	const holidays = holiday_jp.between(startDate.toDate(), dueDate.toDate());
	if (holidays.length > 0) {
		dueDate = dueDate.add(holidays.length, 'day');
		dueDate = skipHolydays(dueDate);
	}

	return {
		startDate,
		dueDate,
	};
}
