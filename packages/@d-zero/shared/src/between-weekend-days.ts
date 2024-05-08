export function betweenWeekendDays(dateA: Date, dateB: Date) {
	let startDate = new Date(dateA);
	let endDate = new Date(dateB);

	if (startDate > endDate) {
		[startDate, endDate] = [endDate, startDate];
	}

	const weekendDays: Date[] = [];

	const currentDate = new Date(startDate);
	while (currentDate <= endDate) {
		if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
			weekendDays.push(currentDate);
		}

		currentDate.setDate(currentDate.getDate() + 1);
	}

	return weekendDays;
}
