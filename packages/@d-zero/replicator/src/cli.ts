#!/usr/bin/env node

import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';
import { parseDevicesOption } from '@d-zero/puppeteer-page-scan';

import { replicate } from './index.js';

interface ReplicatorCLIOptions extends BaseCLIOptions {
	output?: string;
	timeout?: number;
	devices?: string;
}

const { options, args } = createCLI<ReplicatorCLIOptions>({
	aliases: {
		o: 'output',
		v: 'verbose',
		t: 'timeout',
		d: 'devices',
	},
	usage: [
		'Usage: replicator <url> -o <output-directory> [options]',
		'',
		'Options:',
		'  -o, --output <dir>        Output directory (required)',
		'  -t, --timeout <ms>        Request timeout in milliseconds (default: 30000)',
		'  -d, --devices <devices>   Device presets (comma-separated, default: desktop-compact,mobile)',
		'  -v, --verbose             Enable verbose logging',
		'',
		'Available device presets:',
		'  desktop, tablet, mobile, desktop-hd, desktop-compact, mobile-large, mobile-small',
		'',
		'Examples:',
		'  replicator https://example.com -o ./output',
		'  replicator https://example.com -o ./output --devices desktop,tablet',
		'  replicator https://example.com -o ./output --timeout 60000',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		output: cli.output,
		timeout: cli.timeout ? Number(cli.timeout) : undefined,
		devices: cli.devices,
	}),
	validateArgs: (options, cli) => {
		return !!(cli._.length > 0 && options.output);
	},
});

const url = args[0];
const outputDir = options.output!;

if (!url || typeof url !== 'string') {
	// eslint-disable-next-line no-console
	console.error('❌ Error: URL is required');
	process.exit(1);
}

try {
	const deviceNames = options.devices ? parseList(options.devices) : undefined;
	const devices = parseDevicesOption(deviceNames);

	await replicate(url, outputDir, {
		verbose: options.verbose ?? false,
		timeout: options.timeout,
		devices,
	});
	// eslint-disable-next-line no-console
	console.log(`✅ Successfully replicated ${url} to ${outputDir}`);
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
