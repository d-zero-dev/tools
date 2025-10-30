#!/usr/bin/env node

import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';
import { parseDevicesOption } from '@d-zero/puppeteer-page-scan';

import { replicate } from './index.js';

interface ReplicatorCLIOptions extends BaseCLIOptions {
	output?: string;
	timeout?: number;
	devices?: string;
	limit?: number;
	only?: string;
}

const { options, args } = createCLI<ReplicatorCLIOptions>({
	aliases: {
		o: 'output',
		v: 'verbose',
		t: 'timeout',
		d: 'devices',
		l: 'limit',
	},
	usage: [
		'Usage: replicator <url1> [url2...] -o <output-directory> [options]',
		'',
		'Options:',
		'  -o, --output <dir>        Output directory (required)',
		'  -t, --timeout <ms>        Request timeout in milliseconds (default: 30000)',
		'  -d, --devices <devices>   Device presets (comma-separated, default: desktop-compact,mobile)',
		'  -l, --limit <number>      Parallel execution limit (default: 3)',
		'  --interval <ms>           Interval between parallel executions (default: none)',
		'                             Format: number or "min-max" for random range',
		'  --only <type>             Download only specified type: page or resource',
		'  -v, --verbose             Enable verbose logging',
		'',
		'Available device presets:',
		'  desktop, tablet, mobile, desktop-hd, desktop-compact, mobile-large, mobile-small',
		'',
		'Examples:',
		'  replicator https://example.com -o ./output',
		'  replicator https://example.com/page1 https://example.com/page2 -o ./output',
		'  replicator https://example.com -o ./output --devices desktop,tablet',
		'  replicator https://example.com -o ./output --timeout 60000 --limit 5',
		'  replicator https://example.com -o ./output --only page',
		'  replicator https://example.com -o ./output --only resource',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		output: cli.output,
		timeout: cli.timeout ? Number(cli.timeout) : undefined,
		devices: cli.devices,
		limit: cli.limit ? Number(cli.limit) : undefined,
		only: cli.only,
	}),
	validateArgs: (options, cli) => {
		if (options.only && options.only !== 'page' && options.only !== 'resource') {
			return false;
		}
		return !!(cli._.length > 0 && options.output);
	},
});

const urls = args.filter((arg): arg is string => typeof arg === 'string');
const outputDir = options.output!;

if (urls.length === 0) {
	// eslint-disable-next-line no-console
	console.error('❌ Error: At least one URL is required');
	process.exit(1);
}

try {
	const deviceNames = options.devices ? parseList(options.devices) : undefined;
	const devices = parseDevicesOption(deviceNames);

	await replicate({
		urls,
		outputDir,
		verbose: options.verbose ?? false,
		timeout: options.timeout,
		devices,
		limit: options.limit,
		only: options.only as 'page' | 'resource' | undefined,
		interval: options.interval,
	});
} catch (error) {
	if (error instanceof Error) {
		// eslint-disable-next-line no-console
		console.error('❌ Error:', error.message);
		if (options.verbose) {
			// eslint-disable-next-line no-console
			console.error('Stack trace:', error.stack);
		}
	} else {
		// eslint-disable-next-line no-console
		console.error('❌ Unknown error:', error);
	}
	process.exit(1);
}
