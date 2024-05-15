/**
 * Converts the given byte size to kilobytes (KB) or megabytes (MB).
 *
 * @param byte The byte size to convert.
 * @returns The converted size in kilobytes (KB) or megabytes (MB).
 */
export const kbSize = (byte: number) => {
	const kb = Math.round(byte / 1024);
	if (kb < 1024) {
		return `${kb}KB`;
	}
	return Math.round(kb / 1024) + 'MB';
};
