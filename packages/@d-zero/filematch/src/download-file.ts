import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';

import redirects from 'follow-redirects';

/**
 * Downloads a file from the specified URL and saves it to the destination path.
 *
 * @param url The URL of the file to download.
 * @param dest The destination path where the downloaded file will be saved.
 * @returns A promise that resolves when the file is successfully downloaded and saved, or rejects with an error if any occurred.
 */
export function downloadFile(url: URL, dest: string) {
	return new Promise<void>((resolve, reject) => {
		const file = createWriteStream(dest);
		redirects.https
			.get(url, (response) => {
				response.pipe(file);
				file.on('finish', () => {
					file.close(() => {
						resolve();
					});
				});
			})
			.on('error', async (err: unknown) => {
				// Remove the file if an error occurred
				await fs.unlink(dest);
				reject(err);
			});
	});
}
