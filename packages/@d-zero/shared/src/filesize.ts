export const kbSize = (byte: number) => {
	const kb = Math.round(byte / 1024);
	if (kb < 1024) {
		return `${kb}KB`;
	}
	return Math.round(kb / 1024) + 'MB';
};
