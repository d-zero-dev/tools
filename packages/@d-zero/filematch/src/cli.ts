#!/usr/bin/env node
import { createRequire } from 'node:module';

import minimist from 'minimist';

import { filematch, filematchFromListFile } from './filematch.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'filelist',
		v: 'version',
	},
});

// Handle -v / --version option
if (cli.version === true) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`);
	process.exit(0);
}

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
