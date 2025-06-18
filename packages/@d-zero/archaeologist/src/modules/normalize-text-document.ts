/**
 *
 * @param text
 */
export function normalizeTextDocument(text: string) {
	return (
		text
			.trim()
			// Spaces
			.replaceAll(/\s+/g, '\n')
			// Periods
			.replaceAll('。', '。\n')
			// Newlines
			.replaceAll(/\n+/g, '\n')
			.trim()
	);
}
