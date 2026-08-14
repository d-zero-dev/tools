import type { RunBatchOptions } from './run-batch.js';

import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from './cli.js';
import { runBatch } from './run-batch.js';

vi.mock('./run-batch.js', () => ({
	runBatch: vi.fn().mockResolvedValue(),
}));

vi.mock('node:fs', () => ({
	createWriteStream: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
}));

/**
 * @param text
 */
function stdinWith(text: string): NodeJS.ReadableStream {
	const stream = new PassThrough();
	stream.end(text);
	return stream;
}

/**
 * @param stream
 */
function collect(stream: PassThrough): () => string {
	let data = '';
	stream.on('data', (chunk: Buffer) => {
		data += chunk.toString('utf8');
	});
	return () => data;
}

describe('runCli', () => {
	beforeEach(() => {
		vi.mocked(runBatch).mockReset().mockResolvedValue();
		vi.mocked(readFile).mockReset();
		vi.mocked(createWriteStream).mockReset();
	});

	it('prints help and exits 0 for --help', async () => {
		const stdout = new PassThrough();
		const readStdout = collect(stdout);
		const exitCode = await runCli({
			stdin: stdinWith(''),
			stdout,
			stderr: new PassThrough(),
			argv: ['--help'],
			version: '1.0.0',
		});

		expect(exitCode).toBe(0);
		expect(readStdout()).toContain('Usage:');
		expect(runBatch).not.toHaveBeenCalled();
	});

	it('prints the version and exits 0 for --version', async () => {
		const stdout = new PassThrough();
		const readStdout = collect(stdout);
		const exitCode = await runCli({
			stdin: stdinWith(''),
			stdout,
			stderr: new PassThrough(),
			argv: ['--version'],
			version: '1.2.3',
		});

		expect(exitCode).toBe(0);
		expect(readStdout()).toBe('1.2.3\n');
	});

	it('exits 2 and prints usage for an unrecognized flag', async () => {
		const stderr = new PassThrough();
		const readStderr = collect(stderr);
		const exitCode = await runCli({
			stdin: stdinWith(''),
			stdout: new PassThrough(),
			stderr,
			argv: ['--bogus'],
			version: '1.0.0',
		});

		expect(exitCode).toBe(2);
		expect(readStderr()).toContain('unrecognized argument');
	});

	it('reads URLs from stdin and passes them to runBatch', async () => {
		await runCli({
			stdin: stdinWith('https://a.example/\nhttps://b.example/\n'),
			stdout: new PassThrough(),
			stderr: new PassThrough(),
			argv: [],
			version: '1.0.0',
		});

		expect(runBatch).toHaveBeenCalledWith(
			['https://a.example/', 'https://b.example/'],
			expect.anything(),
		);
	});

	it('exits 1 with a message when the URL list fails to parse', async () => {
		const stderr = new PassThrough();
		const readStderr = collect(stderr);
		const exitCode = await runCli({
			stdin: stdinWith('not json'),
			stdout: new PassThrough(),
			stderr,
			argv: ['--input-format', 'json'],
			version: '1.0.0',
		});

		expect(exitCode).toBe(1);
		expect(readStderr()).toContain('anatomist:');
	});

	it('exits 1 with a message when a --viewport spec fails to parse', async () => {
		const stderr = new PassThrough();
		const readStderr = collect(stderr);
		const exitCode = await runCli({
			stdin: stdinWith('https://a.example/'),
			stdout: new PassThrough(),
			stderr,
			argv: ['--viewport', 'not-a-spec'],
			version: '1.0.0',
		});

		expect(exitCode).toBe(1);
		expect(readStderr()).toContain('anatomist:');
	});

	it('writes each onResult callback as a JSONL line to stdout', async () => {
		vi.mocked(runBatch).mockImplementation((_urls, options?: RunBatchOptions) => {
			options?.onResult?.({
				url: 'https://a.example/',
				viewport: { name: 'pc', width: 1280 },
				mainSelector: 'main',
				root: null,
			});
			return Promise.resolve();
		});

		const stdout = new PassThrough();
		const readStdout = collect(stdout);
		const exitCode = await runCli({
			stdin: stdinWith('https://a.example/'),
			stdout,
			stderr: new PassThrough(),
			argv: [],
			version: '1.0.0',
		});

		expect(exitCode).toBe(0);
		const lines = readStdout().trim().split('\n');
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0]!)).toMatchObject({ url: 'https://a.example/' });
	});

	it('exits 1 when runBatch reports a per-URL error via onError', async () => {
		vi.mocked(runBatch).mockImplementation((_urls, options?: RunBatchOptions) => {
			options?.onError?.('https://bad.example/', new Error('boom'));
			return Promise.resolve();
		});

		const stderr = new PassThrough();
		const readStderr = collect(stderr);
		const exitCode = await runCli({
			stdin: stdinWith('https://bad.example/'),
			stdout: new PassThrough(),
			stderr,
			argv: [],
			version: '1.0.0',
		});

		expect(exitCode).toBe(1);
		expect(readStderr()).toContain('failed to analyze https://bad.example/');
	});

	it('reads the URL list from --input instead of stdin when given', async () => {
		vi.mocked(readFile).mockResolvedValue('https://from-file.example/\n');

		await runCli({
			stdin: stdinWith('https://from-stdin.example/'),
			stdout: new PassThrough(),
			stderr: new PassThrough(),
			argv: ['--input', 'urls.txt'],
			version: '1.0.0',
		});

		expect(readFile).toHaveBeenCalledWith('urls.txt', 'utf8');
		expect(runBatch).toHaveBeenCalledWith(
			['https://from-file.example/'],
			expect.anything(),
		);
	});

	it('writes results to the --out file instead of stdout, and closes the stream', async () => {
		const written: string[] = [];
		const mockEnd = vi.fn((callback: () => void) => {
			callback();
		});
		vi.mocked(createWriteStream).mockReturnValue({
			write: vi.fn((chunk: string) => {
				written.push(chunk);
				return true;
			}),
			end: mockEnd,
			// cli.ts の `await using outFile` が要求する Symbol.asyncDispose のスタブ
			[Symbol.asyncDispose]: vi.fn(async () => {}),
		} as never);
		vi.mocked(runBatch).mockImplementation((_urls, options?: RunBatchOptions) => {
			options?.onResult?.({
				url: 'https://a.example/',
				viewport: { name: 'pc', width: 1280 },
				mainSelector: 'main',
				root: null,
			});
			return Promise.resolve();
		});

		const stdout = new PassThrough();
		const readStdout = collect(stdout);
		const exitCode = await runCli({
			stdin: stdinWith('https://a.example/'),
			stdout,
			stderr: new PassThrough(),
			argv: ['--out', 'result.jsonl'],
			version: '1.0.0',
		});

		expect(createWriteStream).toHaveBeenCalledWith('result.jsonl');
		expect(written.join('')).toContain('https://a.example/');
		expect(readStdout()).toBe(''); // stdout must stay untouched when --out is given
		expect(mockEnd).toHaveBeenCalled();
		expect(exitCode).toBe(0);
	});

	it('exits 1 with a message when the --out stream fails to close, instead of throwing', async () => {
		vi.mocked(createWriteStream).mockReturnValue({
			write: vi.fn(() => true),
			end: vi.fn((callback: (error: Error) => void) => {
				callback(new Error('disk full'));
			}),
			[Symbol.asyncDispose]: vi.fn(async () => {}),
		} as never);

		const stderr = new PassThrough();
		const readStderr = collect(stderr);
		const exitCode = await runCli({
			stdin: stdinWith('https://a.example/'),
			stdout: new PassThrough(),
			stderr,
			argv: ['--out', 'result.jsonl'],
			version: '1.0.0',
		});

		expect(exitCode).toBe(1);
		expect(readStderr()).toContain('failed to write result.jsonl');
	});

	it('forwards parsed CLI options to runBatch', async () => {
		await runCli({
			stdin: stdinWith('https://a.example/'),
			stdout: new PassThrough(),
			stderr: new PassThrough(),
			argv: ['--main-selector', '#x', '--max-depth', '3', '--concurrency', '2'],
			version: '1.0.0',
		});

		expect(runBatch).toHaveBeenCalledWith(
			['https://a.example/'],
			expect.objectContaining({ mainContentSelector: '#x', maxDepth: 3, concurrency: 2 }),
		);
	});
});
