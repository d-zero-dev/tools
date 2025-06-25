import type {
	RemoteInspectorOptions,
	ConnectionConfig,
	FileComparison,
} from './types.js';
import type { Change } from 'diff';

import fs from 'node:fs/promises';
import path from 'node:path';

import c from 'ansi-colors';
import { diffLines } from 'diff';
import Client from 'ssh2-sftp-client';

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

			displayComparison(comparison);
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
		comparison.diff = generateDiff(blocks, remoteContent);
	}

	return comparison;
}

/**
 *
 * @param blocks
 * @param remoteContent
 */
function generateDiff(blocks: Change[], remoteContent: string): string {
	const termWidth = process.stdout.columns || 80;
	const contentMaxLineNum = remoteContent.split('\n').length;
	const output: string[] = [];
	let lineNum = 0;

	for (const block of blocks) {
		const lines = block.value.replace(/\n$/, '').split('\n');
		const start = lineNum;

		if (block.added) {
			output.push(c.green(formatLines(lines, start, termWidth)), '\n');
			lineNum += lines.length;
			continue;
		} else if (block.removed) {
			output.push(c.red(formatLines(lines, start, termWidth)), '\n');
			continue;
		}

		if (lines.length < 7) {
			output.push(c.black(formatLines(lines, start, termWidth)), '\n');
			lineNum += lines.length;
			continue;
		}

		const range = 3;
		const top = c.black(formatLines(lines.slice(0, range), start, termWidth));
		const bottom = c.black(
			formatLines(lines.slice(range * -1), start + lines.length - range, termWidth),
		);
		const hr = c.black(`\n${'─'.repeat(termWidth)}\n`);

		if (start === 0) {
			output.push(bottom, '\n');
		} else if (start + lines.length >= contentMaxLineNum - 1) {
			output.push(top, '\n');
		} else {
			output.push(top, hr, bottom, '\n');
		}

		lineNum += lines.length;
	}

	return output.join('');
}

/**
 *
 * @param lines
 * @param start
 * @param width
 */
function formatLines(lines: string[], start: number, width: number): string {
	return lines
		.map((line, iterator) => {
			const lineNum = (start + iterator).toString().padStart(4, ' ');
			return truncateLine(`${lineNum}: ${line}`, width);
		})
		.join('\n');
}

/**
 *
 * @param line
 * @param width
 */
function truncateLine(line: string, width: number): string {
	if (width < line.length) {
		const ellipsis = 3;
		const half = Math.floor(width / 2);
		const segment = half - ellipsis;
		const head = line.slice(0, segment);
		const tail = line.slice(segment * -1);
		line = `${head}${'.'.repeat(ellipsis * 2)}${tail}`;
	}
	return line;
}

/**
 *
 * @param comparison
 */
function displayComparison(comparison: FileComparison): void {
	if (comparison.isTextFile) {
		// eslint-disable-next-line no-console
		console.log(c.bold.green(comparison.relativePath));
	} else {
		// eslint-disable-next-line no-console
		console.log(c.bold.magenta(comparison.relativePath));
	}

	switch (comparison.status) {
		case 'missing': {
			// eslint-disable-next-line no-console
			console.log(`${c.red.bold('Local file is not found')}: ${comparison.relativePath}`);
			break;
		}
		case 'new': {
			// eslint-disable-next-line no-console
			console.log(`${c.green.bold('New file')}: ${comparison.relativePath}`);
			break;
		}
		case 'same': {
			// eslint-disable-next-line no-console
			console.log(
				`${c.bgGreen(' Same ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('=')} ${comparison.remoteSize}`,
			);
			break;
		}
		case 'modified': {
			if (comparison.isTextFile && comparison.diff) {
				const highLow =
					comparison.remoteSize === comparison.localSize
						? c.bold
						: comparison.remoteSize! - comparison.localSize! > 0
							? c.red
							: c.blue;
				// eslint-disable-next-line no-console
				console.log(
					`${c.bgRedBright(' Modified ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('->')} ${highLow(comparison.remoteSize!.toString())}`,
				);
				// eslint-disable-next-line no-console
				console.log(comparison.diff);
			} else {
				const highLow =
					comparison.remoteSize! - comparison.localSize! > 0 ? c.red : c.blue;
				// eslint-disable-next-line no-console
				console.log(
					`${c.bgRedBright(' Modified ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('->')} ${highLow(comparison.remoteSize!.toString())}`,
				);
			}
			break;
		}
	}

	// eslint-disable-next-line no-console
	console.log('');
}
