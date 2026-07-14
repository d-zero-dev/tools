import { Readable, Writable } from 'node:stream';

import { describe, expect, test } from 'vitest';

import { parseArgs, runCli } from './cli.js';

/**
 * Collects everything a writable stream receives into a single string for
 * post-hoc assertion. Backed by an in-memory `Writable` so tests can invoke
 * `runCli` with the same shape it accepts in production (a
 * `NodeJS.WritableStream`).
 */
function makeCollector(): { readonly stream: NodeJS.WritableStream; read(): string } {
	const chunks: Buffer[] = [];
	const stream = new Writable({
		write(chunk: Buffer | string, _encoding, cb) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			cb();
		},
	});
	return { stream, read: () => Buffer.concat(chunks).toString('utf8') };
}

/**
 *
 * @param input
 */
function makeStdin(input: string): NodeJS.ReadableStream {
	return Readable.from([input]);
}

describe('parseArgs', () => {
	test('empty args', () => {
		expect(parseArgs([])).toEqual({});
	});

	test('--help', () => {
		expect(parseArgs(['--help'])).toEqual({ help: true });
	});

	test('--version', () => {
		expect(parseArgs(['-v'])).toEqual({ version: true });
	});

	test('--content-block-attribute takes a value', () => {
		expect(parseArgs(['--content-block-attribute', 'data-bgb'])).toEqual({
			contentBlockAttribute: 'data-bgb',
		});
	});

	test('--content-block-attribute without a value flags an error', () => {
		expect(parseArgs(['--content-block-attribute'])).toEqual({
			unknownFlag: '--content-block-attribute requires a value',
		});
	});

	test('unknown flag is captured', () => {
		expect(parseArgs(['--nope'])).toEqual({ unknownFlag: '--nope' });
	});
});

describe('runCli', () => {
	test('empty stdin produces empty stdout, exit code 0', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(''),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		expect(stdout.read()).toBe('');
	});

	test('valid JSONL in produces JSONL out with same ids and cluster keys', async () => {
		const input = [
			JSON.stringify({
				id: 'a',
				paths: ['news', '1'],
				stylesheetHrefs: [],
				html: '<body><article>one</article></body>',
			}),
			JSON.stringify({
				id: 'b',
				paths: ['news', '2'],
				stylesheetHrefs: [],
				html: '<body><article>two</article></body>',
			}),
			JSON.stringify({
				id: 'c',
				paths: ['about'],
				stylesheetHrefs: [],
				html: '<body><section>about</section></body>',
			}),
		].join('\n');
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(input),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		const lines = stdout.read().split('\n').filter(Boolean);
		expect(lines).toHaveLength(3);
		const parsed = lines.map(
			(line) => JSON.parse(line) as { id: string; clusterKey: string },
		);
		expect(parsed.map((p) => p.id)).toEqual(['a', 'b', 'c']);
		expect(parsed[0]?.clusterKey).toBe(parsed[1]?.clusterKey);
		expect(parsed[0]?.clusterKey).not.toBe(parsed[2]?.clusterKey);
	});

	test('--help prints usage and exits 0', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(''),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: ['--help'],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		expect(stdout.read()).toMatch(/Usage:/);
	});

	test('--version prints version and exits 0', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(''),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: ['--version'],
			version: '1.2.3',
		});
		expect(code).toBe(0);
		expect(stdout.read()).toBe('1.2.3\n');
	});

	test('unknown flag prints stderr and exits 2', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(''),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: ['--unknown'],
			version: '0.0.0',
		});
		expect(code).toBe(2);
		expect(stderr.read()).toMatch(/unrecognized argument "--unknown"/);
	});

	test('malformed JSONL exits 1 with an error line on stderr', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin('this is not json\n'),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(1);
		expect(stderr.read()).toMatch(/failed to parse JSONL/);
	});

	test('JSONL line without an `html` field exits 1', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(`${JSON.stringify({ id: 'x' })}\n`),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(1);
		expect(stderr.read()).toMatch(/missing a string `html` field/);
	});

	test('input pages without an id get the row index as id in output', async () => {
		const input = [
			JSON.stringify({ html: '<body><article>one</article></body>' }),
			JSON.stringify({ html: '<body><section>about</section></body>' }),
		].join('\n');
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(input),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		const parsed = stdout
			.read()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as { id: number | string; clusterKey: string });
		expect(parsed.map((p) => p.id)).toEqual([0, 1]);
	});
});
