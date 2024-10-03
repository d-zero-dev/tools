export function toList(text: string) {
	const lines = text.split('\n');

	// Trim
	const trimmedLines = lines.map((line) => line.trim());

	// Remove empty lines
	const nonEmptyLines = trimmedLines.filter((line) => line.length > 0);

	// Remove comments
	const nonCommentLines = nonEmptyLines.filter((line) => !line.startsWith('#'));

	return nonCommentLines;
}
