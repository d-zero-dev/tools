import type { ReplicateOptions, ChildProcessResult, ChildProcessInput } from './types.js';
import type { DelayOptions } from '@d-zero/shared/delay';

import path from 'node:path';

import { deal, createProcess } from '@d-zero/puppeteer-dealer';
import { devicePresets } from '@d-zero/puppeteer-page-scan';
import { validateSameHost } from '@d-zero/shared/validate-same-host';
import c from 'ansi-colors';

import { downloadResources } from './resource-downloader.js';

/**
 * Encode resource path with MIME type if needed
 * @param pathname - Resource pathname
 * @param mimeType - MIME type (optional)
 * @returns Encoded resource path
 */
function encodeResourcePath(pathname: string, mimeType?: string): string {
	// Normalize empty pathname to "/"
	if (pathname === '') {
		pathname = '/';
	}

	// Check if the last segment has an extension
	const lastSlashIndex = pathname.lastIndexOf('/');
	const lastSegment =
		lastSlashIndex === -1 ? pathname : pathname.slice(lastSlashIndex + 1);
	const hasExtension = lastSegment.includes('.');

	// For paths without extension, encode with MIME type if available
	if (!hasExtension && mimeType) {
		return `${pathname}:::${mimeType}`;
	}

	// For paths with extension or without MIME type, return as-is
	return pathname;
}

/**
 * Collect page URLs without resource scanning (page-only mode)
 * @param urls - Array of URLs to process
 * @param progress - Progress logger function
 * @returns Set of encoded URLs
 */
function collectPageUrlsOnly(
	urls: string[],
	progress: (message: string) => void,
): Set<string> {
	progress(c.bold.yellow('📄 Page-only mode: Skipping resource collection...'));
	progress('');

	const encodedUrls = new Set<string>();
	for (const url of urls) {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname || '/';
		// Encode as HTML page
		const encodedPath = encodeResourcePath(pathname, 'text/html');
		encodedUrls.add(encodedPath);
	}

	progress(c.bold.green(`✅ Prepared ${encodedUrls.size} page(s) for download`));
	return encodedUrls;
}

/**
 * Collect all resource URLs using Puppeteer scanning
 * @param urls - Array of URLs to process
 * @param targetSizes - Device sizes for responsive scanning
 * @param timeout - Request timeout
 * @param verbose - Enable verbose logging
 * @param limit - Parallel execution limit
 * @param progress - Progress logger function
 * @param interval
 * @returns Set of encoded URLs
 */
async function collectAllResourceUrls(
	urls: string[],
	targetSizes: Record<string, { width: number; resolution?: number }>,
	timeout: number,
	verbose: boolean,
	limit: number,
	progress: (message: string) => void,
	interval?: number | DelayOptions,
): Promise<Set<string>> {
	progress(c.bold.yellow('📡 Phase 1: Collecting resource metadata...'));

	const results: ChildProcessResult[] = [];

	await deal(
		urls.map((url) => ({ id: null, url })),
		(_, done, total) => {
			const percentage = Math.round((done / total) * 100);
			return `${c.bold.cyan('🌐 Replicating')} ${done}/${total} (${percentage}%)`;
		},
		() =>
			createProcess<ChildProcessInput, ChildProcessResult>(
				path.resolve(import.meta.dirname, 'child-process.js'),
				{
					devices: targetSizes,
					timeout,
				},
				{},
			),
		{
			verbose,
			limit,
			interval,
			each: (result) => {
				results.push(result);
			},
		},
	);

	progress('');
	progress(
		c.bold.green(`✅ Phase 1 complete: Collected metadata from ${results.length} URL(s)`),
	);

	// Log collected URLs in verbose mode
	if (verbose) {
		progress('');
		progress(c.gray('📋 Collected URLs by page:'));
		for (const result of results) {
			progress(c.gray(`   ${result.url}:`));
			for (const encodedUrl of result.encodedUrls) {
				progress(c.gray(`     - ${encodedUrl}`));
			}
		}
	}

	// Aggregate all resource URLs
	const encodedUrls = new Set<string>();
	for (const result of results) {
		for (const encodedUrl of result.encodedUrls) {
			encodedUrls.add(encodedUrl);
		}
	}

	return encodedUrls;
}

/**
 * Replicate web pages with all their resources to local directories
 *
 * ## Architecture
 *
 * This implementation uses a two-phase architecture for memory efficiency:
 *
 * ### Phase 1: Metadata Collection
 * - Each URL is processed in a separate child process using puppeteer-dealer
 * - Child processes scan pages with Puppeteer and collect resource URLs
 * - For URLs ending with '/' (e.g., https://example.com/), MIME type is captured
 * and encoded as "url:::MIME/type" format
 * - Only metadata (URLs + MIME types) is returned to parent - no buffer data
 *
 * ### Phase 2: Resource Download
 * - Parent process aggregates all metadata and removes duplicates
 * - Parses encoded URLs to determine correct local paths
 * - Downloads resources via fetch() and immediately writes to disk
 * - No resource content is kept in memory
 *
 * This approach minimizes memory usage by avoiding duplicate I/O operations
 * and keeping buffer data out of inter-process communication.
 * @param options - Replication options
 */
export async function replicate(options: ReplicateOptions): Promise<void> {
	const {
		urls,
		outputDir,
		verbose = false,
		timeout = 30_000,
		devices,
		limit = 3,
		only,
		interval,
	} = options;

	if (urls.length === 0) {
		throw new Error('At least one URL is required');
	}

	// Validate that all URLs share the same hostname
	validateSameHost(urls);

	const log = (message: string) => {
		if (!verbose) {
			return;
		}
		// eslint-disable-next-line no-console
		console.log(message);
	};

	const progress = (message: string) => {
		// eslint-disable-next-line no-console
		console.log(message);
	};

	const defaultSizes = {
		'desktop-compact': devicePresets['desktop-compact'],
		mobile: devicePresets.mobile,
	};

	const targetSizes = devices ?? defaultSizes;

	progress(c.bold.cyan(`🌐 Replicating ${urls.length} URL(s)`));
	progress(c.gray(`   Output: ${outputDir}`));
	progress(c.gray(`   Parallel limit: ${limit}`));
	progress('');

	// Phase 1: Collect resource metadata from all URLs
	let allEncodedUrls: Set<string>;
	switch (only) {
		case 'page': {
			allEncodedUrls = collectPageUrlsOnly(urls, progress);
			break;
		}
		case 'resource':
		case undefined: {
			allEncodedUrls = await collectAllResourceUrls(
				urls,
				targetSizes,
				timeout,
				verbose,
				limit,
				progress,
				interval,
			);
			break;
		}
		default: {
			throw new Error(`Invalid only option: ${only satisfies never}`);
		}
	}

	progress('');

	// Phase 2: Download resources
	progress(c.bold.yellow('📦 Phase 2: Downloading resources...'));

	log(`   Total unique resources: ${allEncodedUrls.size}`);

	// Use the first URL as base URL for constructing full URLs
	const baseUrl = urls[0]!;

	// Download all resources
	await downloadResources(
		[...allEncodedUrls],
		baseUrl,
		outputDir,
		progress,
		verbose,
		only,
		interval,
	);

	progress('');
	progress(c.bold.green(`✅ Replication complete!`));
	progress(c.gray(`   All resources saved to: ${outputDir}`));
}
