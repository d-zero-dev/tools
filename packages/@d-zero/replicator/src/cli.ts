#!/usr/bin/env node

import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

import { replicate } from './index.js';

interface ReplicatorCLIOptions extends BaseCLIOptions {
	output?: string;
}

const { options, args } = createCLI<ReplicatorCLIOptions>({
	aliases: {
		o: 'output',
		v: 'verbose',
	},
	usage: ['Usage: replicator <url> -o <output-directory> [--verbose]'],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		output: cli.output,
	}),
	validateArgs: (options, cli) => {
		return !!(cli._.length > 0 && options.output);
	},
});

const url = args[0];
const outputDir = options.output!;

if (!url || typeof url !== 'string') {
	console.error('❌ Error: URL is required');
	process.exit(1);
}

try {
	await replicate(url, outputDir, {
		verbose: options.verbose ?? false,
	});
	console.log(`✅ Successfully replicated ${url} to ${outputDir}`);
} catch (error) {
	if (error instanceof Error) {
		console.error('❌ Error:', error.message);
		if (options.verbose) {
			console.error('Stack trace:', error.stack);
		}
	} else {
		console.error('❌ Unknown error:', error);
	}
	process.exit(1);
}
