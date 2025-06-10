#!/usr/bin/env node
import type { PrintType } from './types.js';
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

import { print } from './print-main-process.js';
import { readConfig } from './read-config.js';

interface PrintCLIOptions extends BaseCLIOptions {
	type?: string;
}

const { options, args, hasConfigFile } = createCLI<PrintCLIOptions>({
	aliases: {
		f: 'listfile',
		t: 'type',
	},
	usage: [
		'Usage:',
		'\tprint -f <listfile> [--type <png|pdf|note>] [--limit <number>] [--debug]',
		'\tprint <url>... [--type <png|pdf|note>] [--limit <number>] [--debug]',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		type: cli.type,
	}),
	validateArgs: (options, cli) => {
		return !!(options.listfile?.length || cli._.length > 0);
	},
});

const type: PrintType =
	options.type === 'note' ? 'note' : options.type === 'pdf' ? 'pdf' : 'png';

if (hasConfigFile) {
	const { urlList, hooks } = await readConfig(options.listfile!);
	await print(urlList, {
		type,
		limit: options.limit,
		debug: options.debug,
		verbose: options.verbose,
		hooks,
	});
	process.exit(0);
}

if (args.length > 0) {
	await print(args, {
		type,
		limit: options.limit,
		verbose: options.verbose,
		debug: options.debug,
	});
	process.exit(0);
}
