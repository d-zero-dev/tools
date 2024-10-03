import type { KeyValue, Separator } from './types.js';

import fs from 'node:fs/promises';

import { toKvList } from './to-kv-list.js';
import { toList } from './to-list.js';

/**
 * Reads a list from a file and optionally parses it into key-value pairs.
 *
 * @param filePath - The path to the file to read.
 * @param keyValueSep - An optional separator to split each line into key-value pairs.
 * @returns A promise that resolves to an array of unknown items or key-value pairs.
 *
 * @example
 * ```typescript
 * const list = await readList('/path/to/file.txt');
 * // list: ['item1', 'item2', 'item3']
 *
 * const kvList = await readList('/path/to/file.txt', ':');
 * // kvList: [{ key: 'key1', value: 'value1' }, { key: 'key2', value: 'value2' }]
 * ```
 */
export async function readList(filePath: string): Promise<string[]>;
export async function readList(
	filePath: string,
	keyValueSep: Separator,
): Promise<KeyValue[]>;
export async function readList(
	filePath: string,
	keyValueSep?: Separator,
): Promise<unknown[]> {
	const fileContent = await fs.readFile(filePath, 'utf8');

	if (!keyValueSep) {
		const list = toList(fileContent);
		return list;
	}

	return toKvList(fileContent, keyValueSep);
}
