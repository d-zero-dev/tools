#!/usr/bin/env node
import minimist from 'minimist';

import { archaeologist } from './archaeologist.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
	},
});

if (cli.listfile?.length) {
	const { pairList, hooks } = await readConfig(cli.listfile);
	await archaeologist(pairList, {
		hooks,
		limit: cli.limit ? Number.parseInt(cli.limit) : undefined,
		debug: !!cli.debug,
		htmlDiffOnly: !!cli.htmlDiffOnly,
	});
	process.exit(0);
}

process.stderr.write('Usage: archaeologist -f <listfile> [--limit <number>]\n');
process.exit(1);
