import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { downloadFile } from './download-file.js';

/**
 * Downloads a file from a URL and returns the path to the downloaded file.
 * If the input is not a URL, it returns the input as is.
 *
 * @param urlOrFilePath - The URL or file path to download.
 * @returns The path to the downloaded file.
 */
export async function urlToFileWhileDownload(urlOrFilePath: string) {
	if (!isURL(urlOrFilePath)) {
		return urlOrFilePath;
	}

	const tempDir = await mkdtemp(path.join(tmpdir(), 'filematch-'));
	const tempFile = path.join(tempDir, path.basename(urlOrFilePath));

	await downloadFile(new URL(urlOrFilePath), tempFile);

	return tempFile;
}

function isURL(urlOrFilePath: string) {
	return urlOrFilePath.startsWith('http://') || urlOrFilePath.startsWith('https://');
}
