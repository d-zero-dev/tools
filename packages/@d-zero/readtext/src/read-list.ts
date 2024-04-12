import type { KeyValue } from './types.js';

import fs from 'node:fs/promises';

/**
 * Reads a list of values from a file.
 *
 * @param filePath - The path to the file.
 * @param keyValue - Optional flag to indicate whether the file contains key-value pairs.
 * @returns A promise that resolves to an array of values from the file.
 */
export async function readList(filePath: string): Promise<string[]>;
export async function readList(filePath: string, keyValue: true): Promise<KeyValue[]>;
export async function readList(filePath: string, keyValue?: true): Promise<unknown[]> {
	const fileContent = await fs.readFile(filePath, 'utf8');
	const list = toList(fileContent);

	if (!keyValue) {
		return list;
	}

	return list.map((line) => {
		const [key, value] = line.split(/\s+/);
		return { key, value };
	});
}

export function toList(fileContent: string) {
	const lines = fileContent.split('\n');

	// Trim
	const trimmedLines = lines.map((line) => line.trim());

	// Remove empty lines
	const nonEmptyLines = trimmedLines.filter((line) => line.length > 0);

	// Remove comments
	const nonCommentLines = nonEmptyLines.filter((line) => !line.startsWith('#'));

	return nonCommentLines;
}
