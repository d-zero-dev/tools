#!/usr/bin/env node
import minimist from 'minimist';

import { filematch, filematchFromListFile } from './filematch.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'filelist',
	},
});

if (cli.filelist) {
	await filematchFromListFile(cli.filelist, {
		verbose: cli.verbose,
	});
	process.exit(0);
}

if (cli._[0] && cli._[1]) {
	await filematch(cli._[0], cli._[1], {
		verbose: cli.verbose,
	});
	process.exit(0);
}
