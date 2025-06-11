#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
import { createCLI, parseCommonOptions } from '@d-zero/cli-core';
import type { RemoteInspectorOptions } from './types.js';
import type { ParsedArgs } from 'minimist';
import { remoteInspector } from './remote-inspector.js';

// Load .env file if it exists
dotenvConfig();

const config = {
	usage: [
		'Usage: remote-inspector [options]',
		'',
		'Compare local and remote files via SSH/SFTP before deployment.',
		'',
		'Options:',
		'  --host <host>           Remote host',
		'  --user <user>           Remote username', 
		'  --key <path>            Path to private key file',
		'  --passphrase <phrase>   Passphrase for private key',
		'  --remote-dir <dir>      Remote directory',
		'  --local-dir <dir>       Local directory (default: .)',
		'  --listfile <file>       File list (default: files.txt)',
		'  --debug                 Enable debug mode',
		'  --verbose               Enable verbose output',
		'',
		'Configuration:',
		'  Settings can be provided via CLI options, environment variables, or .env file.',
		'  Priority: CLI options > environment variables > .env file',
		'',
		'Environment variables (.env file supported):',
		'  RELEASE_HOST            Remote host',
		'  RELEASE_USER            Remote username',
		'  RELEASE_KEY             Path to private key file',
		'  RELEASE_PASS_PHRASE     Passphrase for private key',
		'  RELEASE_DIR             Remote directory',
		'',
		'Example .env file:',
		'  RELEASE_HOST=example.com',
		'  RELEASE_USER=deploy',
		'  RELEASE_KEY=/path/to/key.pem',
		'  RELEASE_DIR=/var/www/html',
	],
	aliases: {
		h: 'host',
		u: 'user',
		k: 'key',
		p: 'passphrase',
		r: 'remote-dir',
		l: 'local-dir',
		f: 'listfile',
		d: 'debug',
		v: 'verbose',
	},
	parseArgs: (cli: ParsedArgs): RemoteInspectorOptions => ({
		...parseCommonOptions(cli),
		host: cli.host || process.env.RELEASE_HOST,
		user: cli.user || process.env.RELEASE_USER,
		keyPath: cli.key || process.env.RELEASE_KEY,
		passphrase: cli.passphrase || process.env.RELEASE_PASS_PHRASE,
		remoteDir: cli['remote-dir'] || process.env.RELEASE_DIR,
		localDir: cli['local-dir'] || '.',
		listfile: cli.listfile || 'files.txt',
	}),
	validateArgs: (options: RemoteInspectorOptions): boolean => {
		if (!options.host) {
			// eslint-disable-next-line no-console
			console.error('Error: --host or RELEASE_HOST is required');
			return false;
		}
		if (!options.user) {
			// eslint-disable-next-line no-console
			console.error('Error: --user or RELEASE_USER is required');
			return false;
		}
		if (!options.keyPath) {
			// eslint-disable-next-line no-console
			console.error('Error: --key or RELEASE_KEY is required');
			return false;
		}
		if (!options.remoteDir) {
			// eslint-disable-next-line no-console
			console.error('Error: --remote-dir or RELEASE_DIR is required');
			return false;
		}
		return true;
	},
};

const { options } = createCLI(config);

try {
	await remoteInspector(options);
} catch (error) {
	// eslint-disable-next-line no-console
	console.error('Error:', error instanceof Error ? error.message : error);
	process.exit(1);
}