import fs from 'node:fs/promises';

/**
 * Reads a text file and returns an array of non-comment lines.
 *
 * @param filePath - The path to the text file.
 * @returns An array of non-comment lines from the text file.
 */
export async function readList(filePath: string) {
	const fileContent = await fs.readFile(filePath, 'utf8');
	const lines = fileContent.split('\n');

	// Trim
	const trimmedLines = lines.map((line) => line.trim());

	// Remove empty lines
	const nonEmptyLines = trimmedLines.filter((line) => line.length > 0);

	// Remove comments
	const nonCommentLines = nonEmptyLines.filter((line) => !line.startsWith('#'));

	return nonCommentLines;
}
