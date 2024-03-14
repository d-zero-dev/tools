import type { OnProgress } from './types.js';

import { compareFiles } from './compare-files.js';
import { urlToFileWhileDownload } from './url-to-file-while-download.js';

/**
 * Compares two files located at the given file paths or URLs.
 *
 * @param filePathOrUrl1 - The file path or URL of the first file to compare.
 * @param filePathOrUrl2 - The file path or URL of the second file to compare.
 * @param onProgress - An optional callback function to track the progress of the comparison.
 * @returns A promise that resolves to the result of the file comparison.
 */
export async function compare(
	filePathOrUrl1: string,
	filePathOrUrl2: string,
	onProgress?: OnProgress,
) {
	const [file1, file2] = await Promise.all([
		urlToFileWhileDownload(filePathOrUrl1),
		urlToFileWhileDownload(filePathOrUrl2),
	]);

	return compareFiles(file1, file2, onProgress);
}
