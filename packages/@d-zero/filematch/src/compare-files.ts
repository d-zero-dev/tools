import type { OnProgress } from './types.js';

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { compareStreams } from './compare-streams.js';

/**
 * Compares two files to check if their contents are identical.
 *
 * @param filePath1 - The path to the first file.
 * @param filePath2 - The path to the second file.
 * @param onProgress - An optional callback function to track the comparison progress.
 * @returns A promise that resolves to `true` if the files are identical, or `false` otherwise.
 */
export async function compareFiles(
	filePath1: string,
	filePath2: string,
	onProgress?: OnProgress,
) {
	const [stat1, stat2] = await Promise.all([fs.stat(filePath1), fs.stat(filePath2)]);
	const size1 = stat1.size;
	const size2 = stat2.size;

	if (size1 !== size2) {
		return false;
	}

	const stream1 = createReadStream(filePath1);
	const stream2 = createReadStream(filePath2);

	return compareStreams(
		stream1,
		stream2,
		onProgress && ((byte) => onProgress(byte / size1)),
	);
}
