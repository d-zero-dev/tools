import type {
	RemoteInspectorOptions,
	ConnectionConfig,
	FileComparison,
} from './types.js';

import fs from 'node:fs/promises';
import path from 'node:path';

import { diffLines } from 'diff';
import Client from 'ssh2-sftp-client';

import { generateDiff } from './diff-formatter.js';
import { displayComparison, ConsoleOutputHandler } from './output.js';

/**
 *
 * @param options
 */
export async function remoteInspector(options: RemoteInspectorOptions): Promise<void> {
	const client = new Client();

	// eslint-disable-next-line no-console
	console.log(`Connect to: ${options.host}`);

	const connectionConfig: ConnectionConfig = {
		host: options.host!,
		username: options.user!,
		privateKey: await fs.readFile(options.keyPath!),
		passphrase: options.passphrase,
	};

	await client.connect(connectionConfig);
	// eslint-disable-next-line no-console
	console.log('Success!');

	const baseDir =
		options.localDir && path.isAbsolute(options.localDir)
			? options.localDir
			: path.resolve(process.cwd(), options.localDir ?? '');

	try {
		const localFilesText = await fs.readFile(options.listfile!, 'utf8');
		const localFiles = localFilesText
			.split('\n')
			.map((line) => line.trim())
			.filter((l) => !!l)
			.map((line) => path.resolve(baseDir, line));

		for (const localFile of localFiles) {
			const comparison = await compareFile(
				client,
				localFile,
				options.localDir!,
				options.remoteDir!,
				options.root,
			);

			const outputHandler = new ConsoleOutputHandler();
			displayComparison(comparison, outputHandler);
		}
	} finally {
		await client.end();
	}
}

/**
 *
 * @param client
 * @param localFile
 * @param localDir
 * @param remoteDir
 * @param root
 */
async function compareFile(
	client: Client,
	localFile: string,
	localDir: string,
	remoteDir: string,
	root?: string,
): Promise<FileComparison> {
	const localPath = path.resolve(localFile);
	const relativePath = path.relative(localDir, localFile);

	// Calculate remote path by removing root prefix
	let remoteRelativePath = relativePath;
	if (root) {
		// If root is set, remove root prefix from relativePath
		const normalizedRoot = path.normalize(root);
		const normalizedRelativePath = path.normalize(relativePath);

		if (normalizedRelativePath.startsWith(normalizedRoot)) {
			// Remove root prefix and leading separator
			remoteRelativePath = normalizedRelativePath.slice(normalizedRoot.length);
			if (remoteRelativePath.startsWith(path.sep)) {
				remoteRelativePath = remoteRelativePath.slice(1);
			}
		}
	}

	const remotePath = path.join(remoteDir, remoteRelativePath);

	const ext = path.extname(localPath);
	const isTextFile = !/^\.(?:png|jpe?g|webp|pdf|mp4|zip)$/i.test(ext);

	const localStat = await fs.stat(localPath).catch(() => null);

	if (!localStat) {
		return {
			localPath,
			remotePath,
			relativePath,
			isTextFile,
			status: 'missing',
		};
	}

	const remoteStat = await client.stat(remotePath).catch((error: unknown) => {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			return null;
		}
		throw error;
	});

	if (remoteStat == null) {
		return {
			localPath,
			remotePath,
			relativePath,
			isTextFile,
			status: 'new',
			localSize: localStat.size,
		};
	}

	const comparison: FileComparison = {
		localPath,
		remotePath,
		relativePath,
		isTextFile,
		status: 'same',
		localSize: localStat.size,
		remoteSize: remoteStat.size,
	};

	if (!isTextFile) {
		comparison.status = localStat.size === remoteStat.size ? 'same' : 'modified';
		return comparison;
	}

	const localContent = await fs.readFile(localPath, 'utf8');
	const remoteContentBuffer = await client.get(remotePath);
	const remoteContent = Buffer.isBuffer(remoteContentBuffer)
		? remoteContentBuffer.toString('utf8')
		: String(remoteContentBuffer);

	const blocks = diffLines(remoteContent, localContent);

	if (blocks.length > 1) {
		comparison.status = 'modified';
		const termWidth = process.stdout.columns || 80;
		comparison.diff = generateDiff(blocks, remoteContent, termWidth);
	}

	return comparison;
}
