import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { downloadFile } from './download-file.js';

/**
 * Downloads a file from a URL and returns the path to the downloaded file.
 * If the input is not a URL, it returns the input as is.
 * @param urlOrFilePath - The URL or file path to download.
 * @returns The path to the downloaded file.
 */
export async function urlToFileWhileDownload(urlOrFilePath: string) {
	if (!isURL(urlOrFilePath)) {
		return urlOrFilePath;
	}

	// Why not `using`/`mkdtempDisposable`: 戻り値の tempFile はこの関数の
	// スコープを抜けた後も呼び出し元がファイルとして参照し続けるため、
	// スコープ脱出と同時にディレクトリを削除するわけにはいかない
	const tempDir = await mkdtemp(path.join(tmpdir(), 'filematch-'));
	const tempFile = path.join(tempDir, path.basename(urlOrFilePath));

	await downloadFile(new URL(urlOrFilePath), tempFile);

	return tempFile;
}

/**
 *
 * @param urlOrFilePath
 */
function isURL(urlOrFilePath: string) {
	return urlOrFilePath.startsWith('http://') || urlOrFilePath.startsWith('https://');
}
