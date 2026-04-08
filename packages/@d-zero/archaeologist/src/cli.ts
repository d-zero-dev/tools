#!/usr/bin/env node
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createRequire } from 'node:module';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';

import { analyze } from './analyze-main-process.js';
import { freeze } from './freeze-main-process.js';
import { readConfig } from './read-config.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

interface ArchaeologistCLIOptions extends BaseCLIOptions {
	type?: string;
	freeze?: string;
	selector?: string;
	ignore?: string;
	devices?: string;
	combined?: boolean;
}

const { options, args, hasConfigFile } = createCLI<ArchaeologistCLIOptions>({
	name: pkg.name,
	version: pkg.version,
	aliases: {
		f: 'listfile',
		t: 'type',
		s: 'selector',
		i: 'ignore',
		d: 'devices',
	},
	usage: [
		'Usage: archaeologist <urlA> <urlB> [options]',
		'       archaeologist -f <listfile> [options]',
		'',
		'Options:',
		'\t-f, --listfile <file>     File containing URL pairs to analyze',
		'\t-t, --type <types>        Analysis types (comma-separated): image,dom,text,code',
		'\t                          image: visual diff, dom: rendered DOM diff,',
		'\t                          text: text content diff, code: raw HTML source diff',
		'\t-d, --devices <devices>   Device presets (comma-separated, default: desktop-compact,mobile)',
		'\t-s, --selector <selector> CSS selector for specific elements',
		'\t-i, --ignore <ignore>     CSS selector for elements to ignore',
		'\t--freeze <file>           Freeze mode: capture reference screenshots',
		'\t--combined                Output side-by-side combined images (environment A and B)',
		'\t--limit <number>          Limit concurrent processes',
		'\t--interval <ms>           Interval between parallel executions (default: none)',
		'\t                          Format: number or "min-max" for random range',
		'\t--debug                   Enable debug mode',
		'\t--verbose                 Enable verbose logging',
		'',
		'Available device presets:',
		'\tdesktop, tablet, mobile, desktop-hd, desktop-compact, mobile-large, mobile-small',
		'',
		'Examples:',
		'\tarchaeologist http://localhost:3000 https://example.com',
		'\tarchaeologist -f urls.txt',
		'\tarchaeologist -f urls.txt --devices desktop,mobile',
		'\tarchaeologist -f urls.txt --combined',
		'\tarchaeologist --freeze urls.txt',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		type: cli.type,
		freeze: cli.freeze,
		selector: cli.selector,
		ignore: cli.ignore,
		devices:
			cli.devices ??
			// Alias for devices
			cli.device,
		combined: cli.combined,
	}),
	validateArgs: (options, cli) => {
		return !!(options.listfile?.length || options.freeze?.length || cli._.length === 2);
	},
});

const analyzeOptions = {
	types: options.type ? parseList(options.type) : undefined,
	selector: options.selector,
	ignore: options.ignore,
	devices: options.devices ? parseList(options.devices) : undefined,
	combined: options.combined,
	limit: options.limit,
	debug: options.debug,
	verbose: options.verbose,
	interval: options.interval,
};

if (hasConfigFile) {
	const { pairList, hooks } = await readConfig(options.listfile!);
	await analyze(pairList, { ...analyzeOptions, hooks });
	process.exit(0);
}

if (options.freeze) {
	const { pairList, hooks } = await readConfig(options.freeze);
	const list = pairList.map(([urlA]) => urlA);
	await freeze(list, {
		hooks,
		limit: options.limit,
		debug: options.debug,
		interval: options.interval,
	});
	process.exit(0);
}

if (args.length === 2) {
	const pairList: [string, string][] = [[args[0]!, args[1]!]];
	await analyze(pairList, { ...analyzeOptions, hooks: [] });
	process.exit(0);
}
