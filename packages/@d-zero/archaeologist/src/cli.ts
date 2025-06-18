#!/usr/bin/env node
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';

import { analyze } from './analyze-main-process.js';
import { freeze } from './freeze-main-process.js';
import { readConfig } from './read-config.js';

interface ArchaeologistCLIOptions extends BaseCLIOptions {
	type?: string;
	freeze?: string;
	selector?: string;
	devices?: string;
}

const { options, hasConfigFile } = createCLI<ArchaeologistCLIOptions>({
	aliases: {
		f: 'listfile',
		t: 'type',
		s: 'selector',
	},
	usage: ['Usage: archaeologist -f <listfile> [--limit <number>]'],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		type: cli.type,
		freeze: cli.freeze,
		selector: cli.selector,
		devices:
			cli.devices ??
			// Alias for devices
			cli.device,
	}),
	validateArgs: (options) => {
		return !!(options.listfile?.length || options.freeze?.length);
	},
});

if (hasConfigFile) {
	const { pairList, hooks } = await readConfig(options.listfile!);
	await analyze(pairList, {
		hooks,
		types: options.type ? parseList(options.type) : undefined,
		selector: options.selector,
		devices: options.devices ? parseList(options.devices) : undefined,
		limit: options.limit,
		debug: options.debug,
		verbose: options.verbose,
	});
	process.exit(0);
}

if (options.freeze) {
	const { pairList, hooks } = await readConfig(options.freeze);
	const list = pairList.map(([urlA]) => urlA);
	await freeze(list, {
		hooks,
		limit: options.limit,
		debug: options.debug,
	});
	process.exit(0);
}
