import type { DelayOptions } from '@d-zero/shared/delay';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { deal } from '@d-zero/dealer';
import { parseEncodedPath } from '@d-zero/shared/encode-resource-path';
import c from 'ansi-colors';

interface ResourceTask {
	url: string;
	localPath: string;
	encodedPath: string;
}

/**
 * Download and save resources to disk
 * @param encodedPaths - Array of encoded pathnames
 * @param baseUrl - Base URL to construct full URLs
 * @param outputDir - Output directory
 * @param logger - Logger function
 * @param verbose - Enable verbose output
 * @param only - Download only specified type: page or resource
 */
/**
 *
 * @param encodedPaths
 * @param baseUrl
 * @param outputDir
 * @param logger
 * @param verbose
 * @param only
 * @param interval
 * @param username
 * @param password
 * @param limit
 */
export async function downloadResources(
	encodedPaths: string[],
	baseUrl: string,
	outputDir: string,
	logger: (message: string) => void,
	verbose = false,
	only?: 'page' | 'resource',
	interval?: number | DelayOptions,
	username?: string,
	password?: string,
	limit = 10,
): Promise<void> {
	const uniqueResources = new Map<string, ResourceTask>();

	// Parse all encoded pathnames
	for (const encodedPath of encodedPaths) {
		const { url, localPath } = parseEncodedPath(encodedPath, baseUrl);

		// Filter based on 'only' option
		// Note: HTML pages always have .html extension after parseEncodedPath
		// - either from "pathname:::text/html" encoding via mimeToExtension
		// - or from original URL path already having .html extension
		const isHtmlPage = localPath.endsWith('.html');

		if (only === 'resource' && isHtmlPage) {
			// Skip HTML pages in resource-only mode
			continue;
		}

		if (only === 'page' && !isHtmlPage) {
			// Skip non-HTML resources in page-only mode
			// (though this shouldn't happen if Phase 1 was skipped correctly)
			continue;
		}

		if (!uniqueResources.has(localPath)) {
			uniqueResources.set(localPath, { url, localPath, encodedPath });
		}
	}

	const tasks = [...uniqueResources.values()];
	const authHeader =
		username && password
			? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
			: undefined;

	if (tasks.length === 0) {
		logger(c.yellow('⚠️  No resources to download'));
		return;
	}

	logger(`📥 Downloading ${tasks.length} unique resources...`);
	logger('');

	let downloaded = 0;
	let failed = 0;

	await deal(
		tasks,
		(task, update, index, setLineHeader) => {
			const fileId = index.toString().padStart(4, '0');
			const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(task.localPath)}: `;
			setLineHeader(lineHeader);

			return async () => {
				update('Fetching%dots%');

				const response = await fetch(task.url, {
					headers: authHeader ? { Authorization: authHeader } : {},
				}).catch((error) => {
					update(c.red(`❌ Fetch failed: ${error.message}`));
					failed++;
					return null;
				});

				if (!response) {
					return;
				}

				if (!response.ok) {
					update(c.red(`❌ HTTP ${response.status}`));
					failed++;
					return;
				}

				update('Reading content%dots%');
				const content = Buffer.from(await response.arrayBuffer());
				const fullPath = path.join(outputDir, task.localPath);
				const dir = path.dirname(fullPath);

				update('Creating directory%dots%');
				const mkdirSuccess = await mkdir(dir, { recursive: true })
					.then(() => true)
					.catch((error) => {
						update(c.red(`❌ Failed to create directory: ${error.message}`));
						failed++;
						return false;
					});

				if (!mkdirSuccess) {
					return;
				}

				update('Writing file%dots%');
				const writeSuccess = await writeFile(fullPath, content)
					.then(() => true)
					.catch((error) => {
						update(c.red(`❌ Failed to write: ${error.message}`));
						failed++;
						return false;
					});

				if (!writeSuccess) {
					return;
				}

				downloaded++;
				update(c.green('✅ Downloaded'));
			};
		},
		{
			limit,
			verbose,
			interval,
			header: (progress, done, total, limit) => {
				const percentage = Math.round(progress * 100);
				if (progress === 1) {
					return `${c.bold.green('📥 Download Complete')} ${done}/${total} (${percentage}%) - ${c.green(`✅ ${downloaded}`)} ${c.red(`❌ ${failed}`)}`;
				}
				return `${c.bold.cyan('📥 Downloading')} %earth% %dots% ${done}/${total} (${percentage}%) - Limit: ${limit}`;
			},
		},
	);

	logger('');
	logger(c.bold.green(`✅ Downloaded: ${downloaded}, Failed: ${failed}`));
}
