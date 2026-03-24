#!/usr/bin/env node

import type { A11yCheckOptions } from './types.js';
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { createRequire } from 'node:module';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';

import { a11yCheck } from './a11y-check.js';
import { readConfig } from './read-config.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

interface A11yCheckCLIOptions extends BaseCLIOptions {
	scenarios?: string;
	cache?: boolean;
	cacheDir?: string;
	locale?: string;
	screenshot?: boolean;
	out?: string;
	credentials?: string;
}

const { options, args, hasConfigFile } = createCLI<A11yCheckCLIOptions>({
	name: pkg.name,
	version: pkg.version,
	aliases: {
		f: 'listfile',
		s: 'screenshot',
		o: 'out',
		c: 'credentials',
	},
	usage: [
		'Usage:',
		'\ta11y-check -f <listfile> [-o <out>] [--limit <limit>] [--cache <true|false>] [--debug] [--verbose]',
		'',
		'Options:',
		'\t-f, --listfile <file>     File containing URLs to check',
		'\t-o, --out <file>          Output file path',
		'\t-c, --credentials <file>  Google credentials JSON file path (or set GOOGLE_AUTH_CREDENTIALS env)',
		'\t--limit <number>          Limit concurrent processes',
		'\t--interval <ms>           Interval between parallel executions (default: none)',
		'\t                          Format: number or "min-max" for random range',
		'\t--cache <true|false>     Enable/disable cache (default: true)',
		'\t--debug                   Enable debug mode',
		'\t--verbose                 Enable verbose logging',
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
		credentials: cli.credentials?.trim() || undefined,
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
	interval: options.interval,
	cache: options.cache,
	cacheDir: options.cacheDir,
	debug: options.debug,
	verbose: options.verbose,
	credentials: options.credentials,
};

if (hasConfigFile) {
	const { urlList, hooks } = await readConfig(options.listfile);
	list.push(...urlList);
	a11yOptions = {
		...a11yOptions,
		hooks,
	};
} else {
	list.push(...args);
}

await a11yCheck(list, options.out, a11yOptions);
