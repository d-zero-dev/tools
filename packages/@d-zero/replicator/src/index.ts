import type { ReplicateOptions, ChildProcessResult, ChildProcessInput } from './types.js';

import path from 'node:path';

import { deal, createProcess } from '@d-zero/puppeteer-dealer';
import { devicePresets } from '@d-zero/puppeteer-page-scan';
import { validateSameHost } from '@d-zero/shared/validate-same-host';
import c from 'ansi-colors';

import { downloadResources } from './resource-downloader.js';

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

	progress('');

	// Phase 2: Aggregate all resource URLs
	progress(c.bold.yellow('📦 Phase 2: Downloading resources...'));

	const allEncodedUrls = new Set<string>();

	for (const result of results) {
		for (const encodedUrl of result.encodedUrls) {
			allEncodedUrls.add(encodedUrl);
		}
	}

	log(`   Total unique resources: ${allEncodedUrls.size}`);

	// Use the first URL as base URL for constructing full URLs
	const baseUrl = urls[0]!;

	// Download all resources
	await downloadResources([...allEncodedUrls], baseUrl, outputDir, log);

	progress('');
	progress(c.bold.green(`✅ Replication complete!`));
	progress(c.gray(`   All resources saved to: ${outputDir}`));
}
