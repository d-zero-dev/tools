#!/usr/bin/env node
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

import { analyze } from './analyze-main-process.js';
import { freeze } from './freeze-main-process.js';
import { parseTypes } from './parse-types.js';
import { readConfig } from './read-config.js';

interface ArchaeologistCLIOptions extends BaseCLIOptions {
	type?: string;
	freeze?: string;
}

const { options, hasConfigFile } = createCLI<ArchaeologistCLIOptions>({
	aliases: {
		f: 'listfile',
		t: 'type',
	},
	usage: ['Usage: archaeologist -f <listfile> [--limit <number>]'],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		type: cli.type,
		freeze: cli.freeze,
	}),
	validateArgs: (options) => {
		return !!(options.listfile?.length || options.freeze?.length);
	},
});

if (hasConfigFile) {
	const { pairList, hooks } = await readConfig(options.listfile!);
	await analyze(pairList, {
		hooks,
		types: options.type ? parseTypes(options.type) : undefined,
		limit: options.limit,
		debug: options.debug,
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
