import type { ReplicateOptions, Resource } from './types.js';
import type { Page } from 'puppeteer';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

import { beforePageScan, devicePresets } from '@d-zero/puppeteer-page-scan';
import { launch } from 'puppeteer';

/**
 *
 * @param url
 * @param outputDir
 * @param options
 */
export async function replicate(
	url: string,
	outputDir: string,
	options: ReplicateOptions = {},
): Promise<void> {
	const { verbose = false, timeout = 30_000, devices } = options;

	const defaultSizes = {
		'desktop-compact': devicePresets['desktop-compact'],
		mobile: devicePresets.mobile,
	};

	const targetSizes = devices ?? defaultSizes;

	const log = (message: string) => {
		if (verbose) {
			// eslint-disable-next-line no-console
			console.log(message);
		}
	};

	// Always show these key progress messages
	const progress = (message: string) => {
		// eslint-disable-next-line no-console
		console.log(message);
	};

	const baseUrl = new URL(url);
	const allResources: Resource[] = [];

	progress(`🚀 Starting replication of ${url}`);
	log(`   Output directory: ${outputDir}`);
	log(`   Device sizes: ${Object.keys(targetSizes).join(', ')}`);

	progress(`🌐 Launching browser...`);
	const browser = await launch({
		headless: true,
	});

	try {
		// Process each device size
		for (const [sizeName, sizeConfig] of Object.entries(targetSizes)) {
			const { width } = sizeConfig;
			const resolution = 'resolution' in sizeConfig ? sizeConfig.resolution : undefined;
			progress(
				`📱 Processing ${sizeName} (${width}px${resolution ? `, ${resolution}x` : ''})...`,
			);

			const page = await browser.newPage();
			const sizeResources: Resource[] = [];

			try {
				await processPageForSize(page, url, baseUrl, sizeResources, {
					sizeName,
					width,
					resolution,
					timeout,
					log,
					progress,
				});

				// Merge resources, avoiding duplicates
				for (const resource of sizeResources) {
					const existing = allResources.find((r) => r.url === resource.url);
					if (!existing) {
						allResources.push(resource);
					} else if (!existing.content && resource.content) {
						existing.content = resource.content;
					}
				}
			} finally {
				await page.close().catch((error) => {
					log(
						`⚠️ Warning: Failed to close page for ${sizeName}: ${error instanceof Error ? error.message : String(error)}`,
					);
				});
			}
		}

		const resourceCount = allResources.length;
		const downloadedCount = allResources.filter((r) => r.content).length;
		progress(
			`📄 Found ${resourceCount} total resources (${downloadedCount} downloaded successfully)`,
		);

		// Ensure output directory exists
		progress(`📁 Creating output directory...`);
		await fs.mkdir(outputDir, { recursive: true });

		// Save all resources
		progress(`💾 Saving files to disk...`);
		const savedCount = await saveResources(allResources, outputDir, log, progress);

		progress(`🎉 Replication complete! ${savedCount} files saved to ${outputDir}`);
	} finally {
		progress(`🔧 Cleaning up browser...`);
		await browser.close().catch((error) => {
			// Log browser close errors but don't throw them
			log(
				`⚠️ Warning: Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
	}
}

/**
 * Process a page for a specific device size
 * @param page
 * @param url
 * @param baseUrl
 * @param resources
 * @param options
 * @param options.sizeName
 * @param options.width
 * @param options.resolution
 * @param options.timeout
 * @param options.log
 * @param options.progress
 */
async function processPageForSize(
	page: Page,
	url: string,
	baseUrl: URL,
	resources: Resource[],
	options: {
		sizeName: string;
		width: number;
		resolution?: number;
		timeout: number;
		log: (message: string) => void;
		progress: (message: string) => void;
	},
) {
	const { sizeName, width, resolution, timeout, log, progress } = options;
	const requestPromises: Promise<void>[] = [];

	// Set up resource detection
	page.on('response', (response) => {
		const responseUrl = response.url();
		const responseUrlObj = new URL(responseUrl);

		// Only handle same-host resources
		if (responseUrlObj.hostname !== baseUrl.hostname) {
			log(`🚫 [${sizeName}] Skipping external resource: ${responseUrl}`);
			return;
		}

		const promise = (async () => {
			// Only process successful responses
			if (!response.ok()) {
				log(`❌ [${sizeName}] Resource failed (${response.status()}): ${responseUrl}`);
				return;
			}

			// Check if this resource is already tracked
			if (resources.some((r) => r.url === responseUrl)) {
				log(`⏭️ [${sizeName}] Already tracked: ${responseUrl}`);
				return;
			}

			log(`📥 [${sizeName}] Processing: ${responseUrl}`);

			// Determine file extension
			const urlExtension = getExtensionFromUrl(responseUrl);
			const extension = urlExtension
				? (() => {
						log(`🔍 [${sizeName}] Extension from URL: ${urlExtension}`);
						return urlExtension;
					})()
				: (() => {
						const contentType = response.headers()['content-type'];
						const ext = getExtensionFromMimeType(contentType);
						log(`🔍 [${sizeName}] Extension from MIME type (${contentType}): ${ext}`);
						return ext;
					})();

			// Generate local path
			const localPath = urlToLocalPath(responseUrl, extension);

			// Download content
			const buffer = await response.buffer().catch((error) => {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log(`❌ [${sizeName}] Failed to download: ${responseUrl} - ${errorMessage}`);
				return null;
			});

			if (!buffer) {
				return;
			}

			resources.push({
				url: responseUrl,
				localPath,
				content: buffer,
			});
			log(`✅ [${sizeName}] Downloaded: ${responseUrl} -> ${localPath}`);
		})();

		requestPromises.push(promise);
	});

	// Set viewport and navigate using beforePageScan (which includes scrolling)
	progress(`📡 [${sizeName}] Setting viewport and navigating...`);
	await beforePageScan(page, url, {
		name: sizeName,
		width,
		resolution,
		timeout,
		listener: (phase, data) => {
			switch (phase) {
				case 'setViewport': {
					const setViewportData = data as {
						name: string;
						width: number;
						resolution?: number;
					};
					log(
						`📱 [${sizeName}] Viewport set: ${setViewportData.width}px${setViewportData.resolution ? ` @ ${setViewportData.resolution}x` : ''}`,
					);
					break;
				}
				case 'load': {
					const loadData = data as { name: string; type: 'open' | 'reaload' };
					log(`📄 [${sizeName}] Page loaded (${loadData.type})`);
					break;
				}
				case 'scroll': {
					const scrollData = data as {
						name: string;
						scrollY: number;
						scrollHeight: number;
						message: string;
					};
					switch (scrollData.message) {
						case 'Start scrolling': {
							log(`📜 [${sizeName}] Starting scroll to trigger lazy loading...`);

							break;
						}
						case 'End of page': {
							log(
								`📜 [${sizeName}] Scroll completed (${scrollData.scrollY}/${scrollData.scrollHeight}px)`,
							);

							break;
						}
						case 'Scrolling': {
							const progress = Math.round(
								(scrollData.scrollY / scrollData.scrollHeight) * 100,
							);
							log(
								`📜 [${sizeName}] Scrolling progress: ${progress}% (${scrollData.scrollY}/${scrollData.scrollHeight}px)`,
							);

							break;
						}
						// No default
					}
					break;
				}
			}
		},
	});

	progress(`⏳ [${sizeName}] Waiting for all resources to load...`);
	// Wait for all downloads to complete
	await Promise.all(requestPromises);

	const resourceCount = resources.length;
	const downloadedCount = resources.filter((r) => r.content).length;
	progress(
		`📄 [${sizeName}] Found ${resourceCount} resources (${downloadedCount} downloaded)`,
	);
}

/**
 *
 * @param resources
 * @param outputDir
 * @param log
 * @param progress
 */
async function saveResources(
	resources: Resource[],
	outputDir: string,
	log: (message: string) => void,
	progress: (message: string) => void,
): Promise<number> {
	let savedCount = 0;
	const totalResources = resources.filter((r) => r.content).length;

	for (const resource of resources) {
		if (resource.content) {
			const fullPath = path.join(outputDir, resource.localPath);
			const dir = path.dirname(fullPath);

			try {
				await fs.mkdir(dir, { recursive: true });
				await fs.writeFile(fullPath, resource.content);
				savedCount++;

				// Show progress every 10 files or for the last file
				if (savedCount % 10 === 0 || savedCount === totalResources) {
					progress(`   Saved ${savedCount}/${totalResources} files...`);
				}

				log(`💾 Saved: ${resource.localPath}`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log(`❌ Failed to save ${resource.localPath}: ${errorMessage}`);
				progress(`   ⚠️  Failed to save ${resource.localPath}`);
				// Continue with other resources instead of failing completely
			}
		}
	}

	return savedCount;
}

/**
 * Extract file extension from URL path
 * @param url
 */
function getExtensionFromUrl(url: string): string | null {
	const urlObj = new URL(url);
	const pathname = urlObj.pathname;
	const lastDot = pathname.lastIndexOf('.');
	const lastSlash = pathname.lastIndexOf('/');

	// Extension exists if dot comes after last slash
	if (lastDot > lastSlash && lastDot !== -1) {
		return pathname.slice(lastDot);
	}

	return null;
}

/**
 * Get file extension from MIME type
 * @param mimeType
 */
function getExtensionFromMimeType(mimeType: string | undefined): string {
	if (!mimeType) {
		return '';
	}

	// Remove charset and other parameters
	const cleanMimeType = mimeType.split(';')[0]?.trim().toLowerCase();

	if (!cleanMimeType) {
		return '';
	}

	const mimeMap: Record<string, string> = {
		'text/html': '.html',
		'text/css': '.css',
		'application/javascript': '.js',
		'text/javascript': '.js',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/svg+xml': '.svg',
		'image/webp': '.webp',
		'image/gif': '.gif',
		'image/x-icon': '.ico',
		'font/woff': '.woff',
		'application/font-woff': '.woff',
		'font/woff2': '.woff2',
		'font/ttf': '.ttf',
		'application/x-font-ttf': '.ttf',
		'font/otf': '.otf',
		'application/x-font-otf': '.otf',
	};

	return mimeMap[cleanMimeType] ?? '';
}

/**
 * Convert URL to local file path
 * @param url
 * @param extension
 */
function urlToLocalPath(url: string, extension: string): string {
	const urlObj = new URL(url);
	let pathname = urlObj.pathname;

	// Remove leading slash
	if (pathname.startsWith('/')) {
		pathname = pathname.slice(1);
	}

	// If path is empty or ends with /, treat as index (with optional extension)
	if (pathname === '' || pathname.endsWith('/')) {
		pathname = pathname + 'index' + extension;
	} else if (!pathname.includes('.')) {
		// If no extension in path, add the provided extension (may be empty)
		pathname = pathname + extension;
	}
	// If extension already exists in path, keep it as-is

	return pathname;
}

export type { ReplicateOptions, Resource } from './types.js';
