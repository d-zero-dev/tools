import type { ReplicateOptions, Resource } from './types.js';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

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
	const { verbose = false, userAgent, timeout = 30_000 } = options;

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
	const resources: Resource[] = [];

	progress(`🚀 Starting replication of ${url}`);
	log(`   Output directory: ${outputDir}`);

	progress(`🌐 Launching browser...`);
	const browser = await launch({
		headless: true,
		timeout,
	});

	progress(`📄 Creating new page...`);
	const page = await browser.newPage();

	if (userAgent) {
		log(`   Setting user agent: ${userAgent}`);
		await page.setUserAgent(userAgent);
	}

	progress(`🔍 Setting up resource detection...`);
	// Collect all requests
	const requestPromises: Promise<void>[] = [];

	page.on('request', (request) => {
		const requestUrl = request.url();
		const requestUrlObj = new URL(requestUrl);

		// Only handle same-host resources
		if (requestUrlObj.hostname === baseUrl.hostname) {
			log(`📥 Intercepting: ${requestUrl}`);

			const localPath = urlToLocalPath(requestUrl);
			const resourceType = getResourceType(requestUrl);

			resources.push({
				url: requestUrl,
				localPath,
				type: resourceType,
			});
		} else {
			log(`🚫 Skipping external resource: ${requestUrl}`);
		}
	});

	page.on('response', (response) => {
		const responseUrl = response.url();
		const responseUrlObj = new URL(responseUrl);

		// Only handle same-host resources
		if (responseUrlObj.hostname === baseUrl.hostname) {
			const promise = (async () => {
				const resource = resources.find((r) => r.url === responseUrl);
				if (resource && response.ok()) {
					await response
						.buffer()
						.then((buffer) => {
							resource.content = buffer;
							log(`✅ Downloaded: ${responseUrl}`);
						})
						.catch((error) => {
							const errorMessage = error instanceof Error ? error.message : String(error);
							log(`❌ Failed to download: ${responseUrl} - ${errorMessage}`);
							// Don't rethrow here as this would break the entire operation
							// Individual resource failures should not stop the whole process
						});
				} else if (resource) {
					log(`❌ Resource failed (${response.status()}): ${responseUrl}`);
				}
			})();

			requestPromises.push(promise);
		}
	});

	try {
		// Navigate to the page
		progress(`📡 Navigating to ${url}...`);
		await page.goto(url, { waitUntil: 'networkidle2', timeout });

		progress(`⏳ Waiting for all resources to load...`);
		// Wait for all downloads to complete
		await Promise.all(requestPromises);

		const resourceCount = resources.length;
		const downloadedCount = resources.filter((r) => r.content).length;
		progress(
			`📄 Found ${resourceCount} resources (${downloadedCount} downloaded successfully)`,
		);

		// Ensure output directory exists
		progress(`📁 Creating output directory...`);
		await fs.mkdir(outputDir, { recursive: true });

		// Save all resources
		progress(`💾 Saving files to disk...`);
		const savedCount = await saveResources(resources, outputDir, log, progress);

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
 *
 * @param url
 */
function urlToLocalPath(url: string): string {
	const urlObj = new URL(url);
	let pathname = urlObj.pathname;

	// Remove leading slash
	if (pathname.startsWith('/')) {
		pathname = pathname.slice(1);
	}

	// If path is empty or ends with /, treat as index.html
	if (pathname === '' || pathname.endsWith('/')) {
		pathname = pathname + 'index.html';
	}

	// If no extension, add .html
	if (!pathname.includes('.')) {
		pathname = pathname + '.html';
	}

	return pathname;
}

/**
 *
 * @param url
 */
function getResourceType(url: string): Resource['type'] {
	const urlObj = new URL(url);
	const pathname = urlObj.pathname.toLowerCase();

	if (
		pathname.endsWith('.html') ||
		pathname.endsWith('.htm') ||
		pathname === '/' ||
		!pathname.includes('.')
	) {
		return 'html';
	}

	if (pathname.endsWith('.css')) {
		return 'css';
	}

	if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
		return 'js';
	}

	if (/\.(?:jpg|jpeg|png|gif|svg|webp|ico)$/.test(pathname)) {
		return 'image';
	}

	if (/\.(?:woff|woff2|ttf|otf|eot)$/.test(pathname)) {
		return 'font';
	}

	return 'other';
}

export type { ReplicateOptions, Resource } from './types.js';
