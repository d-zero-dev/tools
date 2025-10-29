import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { mimeToExtension } from '@d-zero/shared/mime-to-extension';
import { urlToLocalPath } from '@d-zero/shared/url-to-local-path';

/**
 * Parse encoded URL and return the actual URL and local path
 * @param encodedUrl - URL or "url:::MIME/type" format
 */
function parseEncodedUrl(encodedUrl: string): { url: string; localPath: string } {
	const parts = encodedUrl.split(':::');

	if (parts.length === 2) {
		// Format: "url:::MIME/type"
		const url = parts[0]!;
		const mimeType = parts[1];
		const extension = mimeToExtension(mimeType);
		const localPath = urlToLocalPath(url, extension);

		return { url, localPath };
	}

	// Regular URL without MIME encoding
	const url = encodedUrl;
	const localPath = urlToLocalPath(url, '');

	return { url, localPath };
}

/**
 * Download and save resources to disk
 * @param encodedUrls - Array of encoded URLs
 * @param hostname - The common hostname
 * @param outputDir - Output directory
 * @param logger - Logger function
 */
export async function downloadResources(
	encodedUrls: string[],
	hostname: string,
	outputDir: string,
	logger: (message: string) => void,
): Promise<void> {
	const uniqueResources = new Map<string, string>();

	// Parse all encoded URLs
	for (const encodedUrl of encodedUrls) {
		const { url, localPath } = parseEncodedUrl(encodedUrl);
		uniqueResources.set(localPath, url);
	}

	logger(`📥 Downloading ${uniqueResources.size} unique resources...`);

	let downloaded = 0;
	let failed = 0;

	// Download resources in parallel with limited concurrency
	const concurrency = 10;
	const entries = [...uniqueResources.entries()];

	for (let i = 0; i < entries.length; i += concurrency) {
		const batch = entries.slice(i, i + concurrency);

		await Promise.all(
			batch.map(async ([localPath, url]) => {
				const response = await fetch(url).catch((error) => {
					logger(`❌ Failed to fetch ${url}: ${error.message}`);
					failed++;
					return null;
				});

				if (!response) {
					return;
				}

				if (!response.ok) {
					logger(`❌ HTTP ${response.status} for ${url}`);
					failed++;
					return;
				}

				const content = Buffer.from(await response.arrayBuffer());
				const fullPath = path.join(outputDir, hostname, localPath);
				const dir = path.dirname(fullPath);

				await mkdir(dir, { recursive: true }).catch((error) => {
					logger(`❌ Failed to create directory ${dir}: ${error.message}`);
					failed++;
					throw error;
				});

				await writeFile(fullPath, content).catch((error) => {
					logger(`❌ Failed to write ${fullPath}: ${error.message}`);
					failed++;
					throw error;
				});

				downloaded++;
			}),
		);
	}

	logger(`✅ Downloaded: ${downloaded}, Failed: ${failed}`);
}
