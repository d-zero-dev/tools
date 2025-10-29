import type { ReplicateOptions, ChildProcessResult, ChildProcessInput } from './types.js';

import path from 'node:path';

import { deal, createProcess } from '@d-zero/puppeteer-dealer';
import { devicePresets } from '@d-zero/puppeteer-page-scan';
import { validateSameHost } from '@d-zero/shared/validate-same-host';
import c from 'ansi-colors';

import { downloadResources } from './resource-downloader.js';

/**
 * Replicate web pages with all their resources to local directories
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

	// Validate that all URLs share the same hostname
	const hostname = validateSameHost(urls);

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

	progress(c.bold.cyan(`🌐 Replicating ${urls.length} URL(s) from ${hostname}`));
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
		() => {
			return createProcess<ChildProcessInput, ChildProcessResult>(
				path.resolve(import.meta.dirname, 'child-process.js'),
				{
					url: '', // Will be set by eachPage
					outputDir,
					devices: targetSizes,
					timeout,
				},
				{},
			);
		},
		{
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

	// Download all resources
	await downloadResources([...allEncodedUrls], hostname, outputDir, log);

	progress('');
	progress(c.bold.green(`✅ Replication complete!`));
	progress(c.gray(`   All resources saved to: ${path.join(outputDir, hostname)}`));
}
