import sanitize from 'sanitize-filename';

/**
 * Sanitizes a file path by decoding URI-encoded characters and replacing
 * any characters that are unsafe for use in filenames with underscores.
 * @param filePath - The raw file path string (possibly URI-encoded) to sanitize.
 * @returns A sanitized file path string that is safe for use as a filename.
 */
export function safeFilePath(filePath: string): string {
	return sanitize(decodeURI(filePath), {
		replacement: '_',
	});
}
