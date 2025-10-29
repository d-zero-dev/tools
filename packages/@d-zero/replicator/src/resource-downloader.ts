import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { mimeToExtension } from '@d-zero/shared/mime-to-extension';
import { urlToLocalPath } from '@d-zero/shared/url-to-local-path';

/**
 * Parse encoded pathname and return the actual URL and local path
 * @param encodedPath - pathname or "pathname:::MIME/type" format
 * @param baseUrl - Base URL to construct full URL from pathname
 */
function parseEncodedPath(
	encodedPath: string,
	baseUrl: string,
): { url: string; localPath: string } {
	const parts = encodedPath.split(':::');

	if (parts.length === 2) {
		// Format: "pathname:::MIME/type"
		const pathname = parts[0]!;
		const mimeType = parts[1];
		const url = new URL(pathname, baseUrl).href;
		const extension = mimeToExtension(mimeType);
		const localPath = urlToLocalPath(url, extension);

		return { url, localPath };
	}

	// Regular pathname without MIME encoding
	const pathname = encodedPath;
	const url = new URL(pathname, baseUrl).href;
	const localPath = urlToLocalPath(url, '');

	return { url, localPath };
}

/**
 * Download and save resources to disk
 * @param encodedPaths - Array of encoded pathnames
 * @param baseUrl - Base URL to construct full URLs
 * @param outputDir - Output directory
 * @param logger - Logger function
 */
export async function downloadResources(
	encodedPaths: string[],
	baseUrl: string,
	outputDir: string,
	logger: (message: string) => void,
): Promise<void> {
	const uniqueResources = new Map<string, string>();

	// Parse all encoded pathnames
	for (const encodedPath of encodedPaths) {
		const { url, localPath } = parseEncodedPath(encodedPath, baseUrl);
		uniqueResources.set(localPath, url);
		logger(`   Parsed: ${encodedPath} -> ${localPath}`);
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
				const fullPath = path.join(outputDir, localPath);

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
				const dir = path.dirname(fullPath);

				const mkdirSuccess = await mkdir(dir, { recursive: true })
					.then(() => true)
					.catch((error) => {
						logger(`❌ Failed to create directory ${dir}: ${error.message}`);
						failed++;
						return false;
					});

				if (!mkdirSuccess) {
					return;
				}

				const writeSuccess = await writeFile(fullPath, content)
					.then(() => true)
					.catch((error) => {
						logger(`❌ Failed to write ${fullPath}: ${error.message}`);
						failed++;
						return false;
					});

				if (!writeSuccess) {
					return;
				}

				downloaded++;
				logger(`✅ Downloaded ${url} -> ${localPath}`);
			}),
		);
	}

	logger(`✅ Downloaded: ${downloaded}, Failed: ${failed}`);
}
