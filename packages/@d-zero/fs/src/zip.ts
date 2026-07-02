import fs from 'node:fs';

import { ZipArchive } from 'archiver';
import unzipper from 'unzipper';

/**
 *
 * @param outputfilePath
 * @param targetDir
 */
export async function zip(outputfilePath: string, targetDir: string) {
	const output = fs.createWriteStream(outputfilePath);
	const archive = new ZipArchive();

	archive.pipe(output);
	archive.directory(targetDir, false);
	await archive.finalize();

	return new Promise<void>((resolve, reject) => {
		output.on('finish', () => resolve());
		output.on('error', () =>
			reject(`Failed to save file "${outputfilePath}" from "${targetDir}"`),
		);
	});
}

/**
 *
 * @param zipFilePath
 * @param targetDir
 */
export async function unzip(zipFilePath: string, targetDir: string) {
	const extract = fs.createReadStream(zipFilePath).pipe(
		unzipper.Extract({
			path: targetDir,
		}),
	);

	return new Promise<void>((resolve, reject) => {
		extract.on('finish', () => resolve());
		extract.on('error', (err) => reject(err));
	});
}

/**
 *
 * @param zipFilePath
 */
export async function extractZip(zipFilePath: string) {
	const directory = await unzipper.Open.file(zipFilePath);
	return directory;
}
