import dayjs from 'dayjs';

/**
 * Generates a timestamp.
 * If no format is provided, returns the Linux time (epoch seconds) as a string.
 * @param format - Optional format string for the timestamp.
 * @returns The formatted timestamp.
 */
export function timestamp(format?: string): string {
	if (!format) {
		return Math.floor(Date.now() / 1000).toString();
	}
	return dayjs().format(format);
}
