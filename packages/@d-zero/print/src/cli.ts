#!/usr/bin/env node
import type { PrintType } from './types.js';

import minimist from 'minimist';

import { print } from './print.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
		t: 'type',
	},
});

const limit = cli.limit ? Number.parseInt(cli.limit) : undefined;
const debug = !!cli.debug;
const type: PrintType = cli.type === 'note' ? 'note' : cli.type === 'pdf' ? 'pdf' : 'png';

if (cli.listfile?.length) {
	const { urlList } = await readConfig(cli.listfile);
	await print(urlList, { type, limit, debug });
	process.exit(0);
}

if (cli._.length > 0) {
	await print(cli._, { type, limit, debug });
	process.exit(0);
}

process.stderr.write(
	[
		'Usage:',
		'\tprint -f <listfile> [--type <png|pdf|note>] [--limit <number>] [--debug]',
		'\tprint <url>... [--type <png|pdf|note>] [--limit <number>] [--debug]',
	].join('\n') + '\n',
);
process.exit(1);
