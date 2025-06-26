#!/usr/bin/env node
import type { RemoteInspectorOptions } from './types.js';
import type { ParsedArgs } from 'minimist';

import { createCLI, parseCommonOptions } from '@d-zero/cli-core';
import { config as dotenvConfig } from 'dotenv';

import { remoteInspector } from './remote-inspector.js';
import { validateRemoteInspectorArgs } from './validation.js';

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
		'  --password <password>   Password for SSH authentication',
		'  --remote-dir <dir>      Remote directory',
		'  --local-dir <dir>       Local directory (default: .)',
		'  --listfile <file>       File list (default: files.txt)',
		'  --root <path>           Root path prefix to strip from file list paths',
		'  --debug                 Enable debug mode',
		'  --verbose               Enable verbose output',
		'',
		'Configuration:',
		'  Settings can be provided via CLI options, environment variables, or .env file.',
		'  Priority: CLI options > environment variables > .env file',
		'',
		'Authentication:',
		'  You can use either private key authentication or password authentication.',
		'  Private key auth: --key (and optionally --passphrase)',
		'  Password auth: --password',
		'',
		'Environment variables (.env file supported):',
		'  RELEASE_HOST            Remote host',
		'  RELEASE_USER            Remote username',
		'  RELEASE_KEY             Path to private key file',
		'  RELEASE_PASS_PHRASE     Passphrase for private key',
		'  RELEASE_PASSWORD        Password for SSH authentication',
		'  RELEASE_DIR             Remote directory',
		'',
		'Example .env file:',
		'  RELEASE_HOST=example.com',
		'  RELEASE_USER=deploy',
		'  RELEASE_KEY=/path/to/key.pem',
		'  RELEASE_DIR=/var/www/html',
		'',
		'Example .env file (password auth):',
		'  RELEASE_HOST=example.com',
		'  RELEASE_USER=deploy',
		'  RELEASE_PASSWORD=your_password',
		'  RELEASE_DIR=/var/www/html',
	],
	aliases: {
		h: 'host',
		u: 'user',
		k: 'key',
		p: 'passphrase',
		w: 'password',
		r: 'remote-dir',
		l: 'local-dir',
		f: 'listfile',
		o: 'root',
		d: 'debug',
		v: 'verbose',
	},
	parseArgs: (cli: ParsedArgs): RemoteInspectorOptions => ({
		...parseCommonOptions(cli),
		host: cli.host || process.env.RELEASE_HOST,
		user: cli.user || process.env.RELEASE_USER,
		keyPath: cli.key || process.env.RELEASE_KEY,
		passphrase: cli.passphrase || process.env.RELEASE_PASS_PHRASE,
		password: cli.password || process.env.RELEASE_PASSWORD,
		remoteDir: cli['remote-dir'] || process.env.RELEASE_DIR,
		localDir: cli['local-dir'] || '.',
		listfile: cli.listfile || 'files.txt',
		root: cli.root,
	}),
	validateArgs: (options: RemoteInspectorOptions): boolean => {
		try {
			validateRemoteInspectorArgs(options);
			return true;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(`Error: ${error instanceof Error ? error.message : error}`);
			return false;
		}
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
