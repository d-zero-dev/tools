#!/usr/bin/env node
import minimist from 'minimist';

import { analyze } from './analyze-main-process.js';
import { freeze } from './freeze-main-process.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
	},
});

if (cli.listfile?.length) {
	const { pairList, hooks } = await readConfig(cli.listfile);
	await analyze(pairList, {
		hooks,
		limit: cli.limit ? Number.parseInt(cli.limit) : undefined,
		debug: !!cli.debug,
		htmlDiffOnly: !!cli.htmlDiffOnly,
	});
	process.exit(0);
}

if (cli.freeze) {
	const { pairList, hooks } = await readConfig(cli.freeze);
	const list = pairList.map(([urlA]) => urlA);
	await freeze(list, {
		hooks,
		limit: cli.limit ? Number.parseInt(cli.limit) : undefined,
		debug: !!cli.debug,
	});
	process.exit(0);
}

process.stderr.write('Usage: archaeologist -f <listfile> [--limit <number>]\n');
process.exit(1);
