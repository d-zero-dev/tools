#!/usr/bin/env node
import type { FrontMatterResult } from 'front-matter';

import fs from 'node:fs/promises';

import { toList } from '@d-zero/readtext/list';
import fm from 'front-matter';
import minimist from 'minimist';

import { archaeologist } from './archaeologist.js';

const cli = minimist(process.argv.slice(2), {
	alias: {
		f: 'listfile',
	},
});

if (cli.listfile) {
	const fileContent = await fs.readFile(cli.listfile, 'utf8');
	const content: FrontMatterResult<{
		comparisonHost: string;
	}> =
		// @ts-ignore
		fm(fileContent);

	const urlList = toList(content.body);

	const pairList: [string, string][] = urlList.map((urlStr) => {
		const url = new URL(urlStr);
		return [
			url.toString(),
			`${content.attributes.comparisonHost}${url.pathname}${url.search}`,
		];
	});

	await archaeologist(pairList);
	process.exit(0);
}

process.stdout.write('Usage: archaeologist -f <listfile>\n');
process.exit(1);
