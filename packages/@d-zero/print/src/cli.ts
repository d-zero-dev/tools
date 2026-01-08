#!/usr/bin/env node
import type { PrintType } from './types.js';
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createRequire } from 'node:module';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';
import { parseDevicesOption } from '@d-zero/puppeteer-page-scan';

import { print } from './print-main-process.js';
import { readConfig } from './read-config.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

interface PrintCLIOptions extends BaseCLIOptions {
	type?: string;
	devices?: string;
	timeout?: number;
}

const { options, args, hasConfigFile } = createCLI<PrintCLIOptions>({
	name: pkg.name,
	version: pkg.version,
	aliases: {
		f: 'listfile',
		t: 'type',
		d: 'devices',
		T: 'timeout',
	},
	usage: [
		'Usage:',
		'\tprint -f <listfile> [options]',
		'\tprint <url>... [options]',
		'',
		'Options:',
		'\t-f, --listfile <file>     File containing URLs to print',
		'\t-t, --type <type>         Output type: png|pdf|note (default: png)',
		'\t-d, --devices <devices>   Device presets (comma-separated, default: desktop-compact,mobile)',
		'\t-T, --timeout <ms>        Request timeout in milliseconds (default: 30000)',
		'\t--limit <number>          Limit concurrent processes',
		'\t--interval <ms>           Interval between parallel executions (default: none)',
		'\t                           Format: number or "min-max" for random range',
		'\t--debug                   Enable debug mode',
		'\t--verbose                 Enable verbose logging',
		'',
		'Available device presets:',
		'\tdesktop, tablet, mobile, desktop-hd, desktop-compact, mobile-large, mobile-small',
		'',
		'Examples:',
		'\tprint https://example.com',
		'\tprint -f urls.txt --type pdf',
		'\tprint https://example.com --devices desktop,mobile',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		type: cli.type,
		devices: cli.devices,
		timeout: cli.timeout ? Number(cli.timeout) : undefined,
	}),
	validateArgs: (options, cli) => {
		return !!(options.listfile?.length || cli._.length > 0);
	},
});

const type: PrintType =
	options.type === 'note' ? 'note' : options.type === 'pdf' ? 'pdf' : 'png';

const deviceNames = options.devices ? parseList(options.devices) : undefined;
const devices = parseDevicesOption(deviceNames);

if (hasConfigFile) {
	const { urlList, hooks } = await readConfig(options.listfile!);
	await print(urlList, {
		type,
		limit: options.limit,
		debug: options.debug,
		verbose: options.verbose,
		hooks,
		devices,
		timeout: options.timeout,
		interval: options.interval,
	});
	process.exit(0);
}

if (args.length > 0) {
	await print(args, {
		type,
		limit: options.limit,
		verbose: options.verbose,
		debug: options.debug,
		devices,
		timeout: options.timeout,
		interval: options.interval,
	});
	process.exit(0);
}
