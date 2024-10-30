#!/usr/bin/env node

import type { A11yCheckOptions } from './types.js';

import minimist from 'minimist';

import { a11yCheck } from './a11y-check.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
		s: 'screenshot',
		o: 'out',
	},
});

const limit = cli.limit ? Number.parseInt(cli.limit) : undefined;
const cache = cli.cache?.trim().toLowerCase() === 'false' ? false : true;
const cacheDir: string = cli.cacheDir ?? '.cache';
const debug = !!cli.debug;
const verbose = !!cli.verbose;
const locale = cli.locale;
const screenshot = !!cli.screenshot;
const out: string | undefined = cli.out?.trim() || undefined;

const list: (string | { id: string | null; url: string })[] = [];

let options: A11yCheckOptions = {
	screenshot,
	locale,
	limit,
	cache,
	cacheDir,
	debug,
	verbose,
};

if (cli.listfile?.length) {
	const { urlList, hooks } = await readConfig(cli.listfile);
	list.push(...urlList);
	options = {
		...options,
		hooks,
	};
} else if (cli._.length > 0) {
	list.push(...cli._);
} else {
	process.stderr.write(
		[
			'Usage:',
			'\ta11y-check -f <listfile> [-o <out>] [--limit <limit>] [--cache <true|false>] [--debug] [--verbose]',
		].join('\n') + '\n',
	);
	process.exit(1);
}

await a11yCheck(list, out, options);
