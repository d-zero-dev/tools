#!/usr/bin/env node
import minimist from 'minimist';

import { print } from './print.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
	},
});

const limit = cli.limit ? Number.parseInt(cli.limit) : undefined;
const debug = !!cli.debug;

if (cli.listfile?.length) {
	const { urlList } = await readConfig(cli.listfile);
	await print(urlList, { limit, debug });
	process.exit(0);
}

if (cli._.length > 0) {
	await print(cli._, { limit, debug });
	process.exit(0);
}

process.stderr.write(
	[
		'Usage:',
		'\tprint -f <listfile> [--limit <number>] [--debug]',
		'\tprint <url>... [--limit <number>] [--debug]',
	].join('\n') + '\n',
);
process.exit(1);
