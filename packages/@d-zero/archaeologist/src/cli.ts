#!/usr/bin/env node
import minimist from 'minimist';

import { archaeologist } from './archaeologist.js';
import { readConfig } from './read-config.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
	},
});

if (cli.listfile) {
	const { pairList, pageHooks } = await readConfig(cli.listfile);
	await archaeologist(pairList, pageHooks);
	process.exit(0);
}

process.stdout.write('Usage: archaeologist -f <listfile>\n');
process.exit(1);
