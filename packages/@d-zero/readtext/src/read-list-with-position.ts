import fs from 'node:fs/promises';

import { toListWithPosition } from './to-list-with-position.js';

/**
 * Reads a list file and returns each surviving line tagged with its
 * 1-origin line/column position in the source file — the position-aware
 * companion to `readList`, for callers that need to report which line of
 * the file an invalid entry came from.
 * @param filePath - The path to the file to read.
 * @returns A promise that resolves to the surviving lines with position info.
 * @example
 * ```typescript
 * const items = await readListWithPosition('/path/to/file.txt');
 * // items: [{ value: 'item1', line: 1, column: 1 }, ...]
 * ```
 */
export async function readListWithPosition(filePath: string) {
	const fileContent = await fs.readFile(filePath, 'utf8');
	return toListWithPosition(fileContent);
}
