#!/usr/bin/env node

import type { A11yCheckOptions } from './types.js';
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

import { a11yCheck } from './a11y-check.js';
import { readConfig } from './read-config.js';

interface A11yCheckCLIOptions extends BaseCLIOptions {
	scenarios?: string;
	cache?: boolean;
	cacheDir?: string;
	locale?: string;
	screenshot?: boolean;
	out?: string;
}

const { options, args, hasConfigFile } = createCLI<A11yCheckCLIOptions>({
	aliases: {
		f: 'listfile',
		s: 'screenshot',
		o: 'out',
	},
	usage: [
		'Usage:',
		'\ta11y-check -f <listfile> [-o <out>] [--limit <limit>] [--cache <true|false>] [--debug] [--verbose]',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		listfile: cli.listfile,
		scenarios: cli.scenarios,
		cache: cli.cache?.trim().toLowerCase() === 'false' ? false : true,
		cacheDir: cli.cacheDir ?? '.cache',
		locale: cli.locale,
		screenshot: !!cli.screenshot,
		out: cli.out?.trim() || undefined,
	}),
	validateArgs: (options, cli) => {
		return !!(options.listfile?.length || cli._.length > 0);
	},
});

const list: (string | { id: string | null; url: string })[] = [];

let a11yOptions: A11yCheckOptions = {
	scenarios: options.scenarios?.split(',').map((s) => s.trim().toLowerCase()),
	screenshot: options.screenshot,
	locale: options.locale,
	limit: options.limit,
	cache: options.cache,
	cacheDir: options.cacheDir,
	debug: options.debug,
	verbose: options.verbose,
};

if (hasConfigFile) {
	const { urlList, hooks } = await readConfig(options.listfile!);
	list.push(...urlList);
	a11yOptions = {
		...a11yOptions,
		hooks,
	};
} else {
	list.push(...args);
}

await a11yCheck(list, options.out, a11yOptions);
