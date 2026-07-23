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

/**
 * Removes ANSI SGR (`\x1B[…m`) escape sequences from a captured stream so
 * regex assertions against Lanes-produced verbose output can focus on the
 * human-readable payload. Lanes wraps every verbose line as
 * `RESET header RESET message RESET`, and those RESET codes would otherwise
 * sit between the `[page-cluster]` header and the trailing message,
 * breaking any regex that spans that boundary.
 * @param text
 */
function stripAnsi(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replaceAll(/\u001B\[[\d;]*m/g, '');
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

	test('--include-landmark-positions', () => {
		expect(parseArgs(['--include-landmark-positions'])).toEqual({
			includeLandmarkPositions: true,
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

	test('--help mentions --include-landmark-positions', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		await runCli({
			stdin: makeStdin(''),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: ['--help'],
			version: '0.0.0',
		});
		expect(stdout.read()).toMatch(/--include-landmark-positions/);
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

	test('emits reading / clustered / done progress lines on stderr (non-TTY)', async () => {
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
		const stderrText = stripAnsi(stderr.read());
		// The `makeCollector` `Writable` has no `isTTY` so CLI routes through
		// Lanes' verbose path, producing plain `[page-cluster] …` lines that
		// this test can regex directly (after stripping the RESET codes
		// Lanes wraps around every field). Verbose lines keep the original
		// `pass1:` / `stage-b:` phase tokens for grep/awk compatibility.
		expect(stderrText).toMatch(/\[page-cluster\] reading input pages/);
		expect(stderrText).toMatch(/\[page-cluster\] read 3 pages, clustering/);
		expect(stderrText).toMatch(/\[page-cluster\] pass1: clustered block \d+\/\d+/);
		expect(stderrText).toMatch(/\[page-cluster\] done — 3 pages in \d+ clusters/);
		// Regression guard for the "literal 'undefined ' prefix" bug that
		// code-review high effort caught before this commit: an unset
		// lanes.header made every verbose progress line begin with the
		// string "undefined " ahead of the "[page-cluster]" chunk.
		expect(stderrText).not.toMatch(/undefined \[page-cluster\]/);
	});

	test('malformed JSONL still closes the Lanes display (no timer leak / process hang) and surfaces the error via Lanes', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		// A Node timer leak would hang this test because Vitest waits for the
		// event loop to drain. If `runCli` resolves without hanging, the
		// `try/finally` did its job of releasing the Display's setTimeout.
		const code = await runCli({
			stdin: makeStdin('this is not json\n'),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(1);
		// The error is routed through Lanes so a TTY Display.close() repaint
		// would not erase it. Verbose mode surfaces it as `[page-cluster] error: <message>`.
		expect(stripAnsi(stderr.read())).toMatch(
			/\[page-cluster\] error: .*failed to parse JSONL/,
		);
	});

	test('--include-landmark-positions adds a landmarks field to each output line', async () => {
		const input = [
			JSON.stringify({
				id: 'a',
				paths: ['news', '1'],
				stylesheetHrefs: [],
				html: '<body><header>H</header><main><article>one</article></main></body>',
			}),
			JSON.stringify({
				id: 'b',
				paths: ['news', '2'],
				stylesheetHrefs: [],
				html: '<body><header>H</header><main><article>two</article></main></body>',
			}),
		].join('\n');
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(input),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: ['--include-landmark-positions'],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		const lines = stdout.read().split('\n').filter(Boolean);
		expect(lines).toHaveLength(2);
		const parsed = lines.map(
			(line) =>
				JSON.parse(line) as {
					id: string;
					clusterKey: string;
					landmarks: { header: { isChrome: boolean }[]; main: object[] };
				},
		);
		expect(parsed[0]!.landmarks.header[0]!.isChrome).toBe(true);
		expect(parsed[0]!.landmarks.main).toHaveLength(1);
	});

	test('without --include-landmark-positions, output lines carry no landmarks field', async () => {
		const stdout = makeCollector();
		const stderr = makeCollector();
		const code = await runCli({
			stdin: makeStdin(
				JSON.stringify({ id: 'a', html: '<body><header>H</header></body>' }),
			),
			stdout: stdout.stream,
			stderr: stderr.stream,
			argv: [],
			version: '0.0.0',
		});
		expect(code).toBe(0);
		const line = stdout.read().split('\n').find(Boolean);
		expect(JSON.parse(line!)).not.toHaveProperty('landmarks');
	});
});
