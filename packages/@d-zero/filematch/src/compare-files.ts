import type { OnProgress } from './types.js';

import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { compareStreams } from './compare-streams.js';

/**
 * Compares two files to check if their contents are identical.
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

	// Why not `await using`: Node.js の stream の `Symbol.asyncDispose` は
	// stream が既に error で終了している場合、dispose 時にその error を再度
	// reject するため、compareStreams() の失敗が `SuppressedError`（message は
	// 空文字列）に包まれて原因が呼び出し元から見えなくなる。try/finally +
	// `destroy()`（同期・冪等・throw しない）で同等の解放保証を得る。
	const stream1 = createReadStream(filePath1);
	const stream2 = createReadStream(filePath2);

	try {
		return await compareStreams(
			stream1,
			stream2,
			onProgress && ((byte) => onProgress(byte / size1)),
		);
	} finally {
		stream1.destroy();
		stream2.destroy();
	}
}
