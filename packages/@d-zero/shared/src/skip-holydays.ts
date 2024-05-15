import type dayjs from 'dayjs';

import holiday_jp from '@holiday-jp/holiday_jp';

/**
 * Skips holidays and weekends in the given date and returns the next available date.
 *
 * @param date - The date to skip holidays and weekends from.
 * @returns The next available date after skipping holidays and weekends.
 */
export function skipHolydays(date: dayjs.Dayjs) {
	let current = date.clone();

	if (current.day() === 0) {
		// Skip Sunday
		current = current.add(1, 'day');
	} else if (current.day() === 6) {
		// Skip Saturday and Sunday
		current = current.add(2, 'day');
	}

	if (holiday_jp.isHoliday(current.toDate())) {
		current = current.add(1, 'day');
	}

	return current;
}
