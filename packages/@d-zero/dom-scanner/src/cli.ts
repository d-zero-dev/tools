#!/usr/bin/env node

import type { ProcessorType } from './types.js';
import type { BaseCLIOptions } from '@d-zero/cli-core';

import { cwd } from 'node:process';

import { createCLI, parseCommonOptions, parseList } from '@d-zero/cli-core';

import { scanDirectory } from './scanner.js';

interface DomScannerCLIOptions extends BaseCLIOptions {
	dir?: string;
	directory?: string;
	ext?: string;
	extension?: string;
	processor?: string;
	ignore?: string | string[];
	'exclude-dirs'?: string;
	excludeDirs?: string;
}

const { options: cliOptions, args } = createCLI<DomScannerCLIOptions>({
	aliases: {
		d: 'dir',
		D: 'directory',
		e: 'ext',
		E: 'extension',
		p: 'processor',
		i: 'ignore',
		x: 'exclude-dirs',
		v: 'verbose',
	},
	usage: [
		'Usage: dom-scanner <selector> [options]',
		'',
		'Arguments:',
		'\t<selector>               CSS selector (required)',
		'',
		'Options:',
		'\t-d, --dir <directory>    Directory to scan (default: current directory)',
		'\t-D, --directory          Alias for --dir',
		'\t-e, --ext <extensions>   File extensions to search (comma-separated, default: html)',
		'\t-E, --extension          Alias for --ext',
		'\t-p, --processor <proc>   Processor to use: html or pug (default: auto-detect by extension)',
		'\t-i, --ignore <pattern>   Ignore file patterns (can be specified multiple times)',
		'\t-x, --exclude-dirs <dirs> Exclude directories (comma-separated)',
		'\t-v, --verbose            Enable verbose logging',
		'',
		'Examples:',
		'\tdom-scanner "button"',
		'\tdom-scanner "button" --dir ./src',
		'\tdom-scanner "button" --ext html,pug',
		'\tdom-scanner "button" --dir ./src --ext html --processor pug',
		'\tdom-scanner "button" --exclude-dirs node_modules,dist',
	],
	parseArgs: (cli) => ({
		...parseCommonOptions(cli),
		dir: cli.dir ?? cli.directory,
		ext: cli.ext ?? cli.extension,
		processor: cli.processor,
		ignore: cli.ignore,
		'exclude-dirs': cli['exclude-dirs'] ?? cli.excludeDirs,
	}),
	validateArgs: (_options, cli) => {
		return cli._.length > 0;
	},
});

const [selector] = args;

if (!selector) {
	process.stderr.write('Error: selector is required\n');
	process.exit(1);
}

const directory = cliOptions.dir ?? cwd();

const extensions = cliOptions.ext
	? parseList(cliOptions.ext).map((ext) => ext.toLowerCase().trim())
	: undefined;

const processor = cliOptions.processor as ProcessorType | undefined;
if (processor && processor !== 'html' && processor !== 'pug') {
	process.stderr.write(`Error: processor must be 'html' or 'pug', got '${processor}'\n`);
	process.exit(1);
}

const ignorePatterns = cliOptions.ignore
	? Array.isArray(cliOptions.ignore)
		? cliOptions.ignore
		: [cliOptions.ignore]
	: undefined;

const excludeDirs = cliOptions['exclude-dirs']
	? parseList(cliOptions['exclude-dirs']).map((dir) => dir.trim())
	: undefined;

const summary = await scanDirectory(directory, selector, {
	extensions,
	processor,
	verbose: cliOptions.verbose,
	ignore: ignorePatterns,
	excludeDirs,
});

// 結果を表示
if (summary.results.length === 0) {
	process.stdout.write('検索結果: 見つかりませんでした\n');
} else {
	process.stdout.write('検索結果:\n');
	for (const result of summary.results) {
		process.stdout.write(`  ${result.filePath}: ${result.count}件\n`);
	}
	process.stdout.write('\n');
	process.stdout.write(
		`合計: ${summary.totalFiles}ファイル, ${summary.totalMatches}件の要素が見つかりました\n`,
	);
}

process.exit(0);
