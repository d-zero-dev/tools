#!/usr/bin/env node
// Wires the `anatomist` executable to `runBatch`. Reads a URL list from a
// file or stdin, writes one JSON result per (URL, viewport) to stdout (or
// `--out`), and streams `deal()`'s progress to stderr — in-place animated
// header on a TTY, appended lines otherwise (see `@d-zero/dealer`'s `Lanes`).

import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { unwrapSuppressedError } from '@d-zero/cli-core';

import { formatResultLine } from './format-output.js';
import { parseArgs } from './parse-args.js';
import { parseUrlList } from './parse-url-list.js';
import { resolveViewports } from './resolve-viewports.js';
import { runBatch } from './run-batch.js';

const HELP_TEXT = `Usage:
  anatomist [options] < urls.txt > results.jsonl

Reads one URL per line from stdin (or --input), renders each in a real
browser at one or more viewports, and writes one JSON result per
(url, viewport) pair to stdout, in the order URLs and viewports were given.

Output shape (one line per result, JSONL):
  {
    "url": "...",
    "viewport": { "name": "pc", "width": 1280 },
    "mainSelector": "main#content" | null,
    "root": {
      "layoutType": "vertical-stack" | "horizontal-row" | "simple-grid" |
                     "complex-grid" | "table" | "float-wrap" | "unknown" | "leaf",
      "tagName": "DIV", "id": null, "classList": [],
      "boundingBox": { "x": 0, "y": 0, "width": 800, "height": 400 },
      "innerHTML": "...",
      "confidence": 0.85,
      "signals": { "...": "..." },
      "children": [ /* same shape, recursively */ ]
    } | null
  }

Options:
  --input, -f <path>          Read the URL list from <path> instead of stdin.
  --input-format <format>     "lines" (default, one URL per line, # comments
                               ignored) or "json" (a JSON array of strings).
  --main-selector <selector>  Skip main-element auto-detection and use this
                               selector directly.
  --viewport <name:width>     Analyze this viewport instead of the default
                               preset (pc:1280, tablet:768, sp:375). Repeat
                               to analyze several; height is derived from
                               width, not settable.
  --max-depth <n>             Maximum classification depth (default 6).
  --min-area <px>             Minimum child box area to count as meaningful
                               (default 800).
  --inner-html <mode>         "all" (default), "leaf-only", or "none" —
                               controls which blocks carry innerHTML.
  --no-bounding-box           Omit boundingBox from the output.
  --concurrency <n>           URLs processed concurrently (default 1).
  --timeout <ms>              Navigation timeout per viewport.
  --max-scroll-height <px>    Skip the full-page scroll on pages taller than
                               this (passed through to beforePageScan).
  --out <path>                Write results to <path> instead of stdout.
  --pretty                    Pretty-print each result (2-space indent).
  --help                      Print this help and exit.
  --version                   Print the package version and exit.

Progress is written to stderr; the JSONL output on stdout is unaffected.
Silence it with 2>/dev/null.
`;

/**
 * @param stream
 */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
	stream.setEncoding?.('utf8');
	const chunks: string[] = [];
	for await (const chunk of stream) {
		chunks.push(chunk as string);
	}
	return chunks.join('');
}

/**
 * Test-friendly entry point: takes the run's stdin/stdout/stderr streams
 * and the parsed CLI flags rather than reading them out of the process
 * globals (pattern shared with `@d-zero/page-cluster`'s `runCli`).
 * @param options
 * @param options.stdin
 * @param options.stdout
 * @param options.stderr
 * @param options.argv
 * @param options.version
 */
export async function runCli(options: {
	stdin: NodeJS.ReadableStream;
	stdout: NodeJS.WritableStream;
	stderr: NodeJS.WritableStream;
	argv: readonly string[];
	version: string;
}): Promise<number> {
	const args = parseArgs(options.argv);
	if (args.help) {
		options.stdout.write(HELP_TEXT);
		return 0;
	}
	if (args.version) {
		options.stdout.write(`${options.version}\n`);
		return 0;
	}
	if (args.unknownFlag !== undefined) {
		options.stderr.write(
			`anatomist: unrecognized argument ${JSON.stringify(args.unknownFlag)}\n`,
		);
		options.stderr.write(HELP_TEXT);
		return 2;
	}

	const inputText = args.input
		? await readFile(args.input, 'utf8')
		: await readAll(options.stdin);

	let urls: string[];
	try {
		urls = parseUrlList(inputText, args.inputFormat);
	} catch (error) {
		options.stderr.write(`anatomist: ${(error as Error).message}\n`);
		return 1;
	}

	let viewports;
	try {
		viewports = resolveViewports(args.viewports);
	} catch (error) {
		options.stderr.write(`anatomist: ${(error as Error).message}\n`);
		return 1;
	}

	// `await using` により、runBatch() が想定外の例外を投げてスコープを抜けても
	// --out で開いたファイル記述子が確実に閉じられる（stdout の場合は outFile が
	// undefined のままなので dispose は no-op — process.stdout を誤って
	// close してしまうことはない）。
	await using outFile = args.out ? createWriteStream(args.out) : undefined;
	const outStream: NodeJS.WritableStream = outFile ?? options.stdout;

	let hadError = false;
	await runBatch(urls, {
		viewports,
		mainContentSelector: args.mainSelector,
		maxDepth: args.maxDepth,
		minArea: args.minArea,
		concurrency: args.concurrency,
		timeout: args.timeout,
		maxScrollHeight: args.maxScrollHeight,
		stderr: options.stderr,
		onResult: (result) => {
			const line = formatResultLine(result, {
				pretty: args.pretty,
				includeBoundingBox: !args.noBoundingBox,
				innerHtmlMode: args.innerHtml,
			});
			outStream.write(`${line}\n`);
		},
		onError: (url, error) => {
			hadError = true;
			// SuppressedError（using スコープ内で本体と dispose の両方が例外を投げた
			// 場合）を分解し、定型メッセージの裏に隠れる根本原因を両方とも出力する
			for (const cause of unwrapSuppressedError(error)) {
				options.stderr.write(
					`anatomist: failed to analyze ${url}: ${cause instanceof Error ? cause.message : String(cause)}\n`,
				);
			}
		},
	});

	if (outFile) {
		try {
			await new Promise<void>((resolve, reject) => {
				outFile.end((error?: Error | null) => {
					if (error) {
						reject(error);
					} else {
						resolve();
					}
				});
			});
		} catch (error) {
			// Consistent with every other failure path here: report to stderr
			// and return a non-zero exit code, rather than letting the error
			// propagate as an unhandled rejection out of runCli.
			options.stderr.write(
				`anatomist: failed to write ${args.out}: ${(error as Error).message}\n`,
			);
			return 1;
		}
	}

	return hadError ? 1 : 0;
}

/**
 * Reads the package version out of `package.json` at runtime. Kept as a
 * separate helper so `runCli` can be exercised in tests without needing a
 * real `package.json` on disk.
 */
async function readPackageVersion(): Promise<string> {
	try {
		const url = new URL('../package.json', import.meta.url);
		const raw = await readFile(url, 'utf8');
		const parsed = JSON.parse(raw) as { version?: string };
		return parsed.version ?? '0.0.0';
	} catch {
		return '0.0.0';
	}
}

// Only run when invoked as the actual entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
	const version = await readPackageVersion();
	const exitCode = await runCli({
		stdin: process.stdin,
		stdout: process.stdout,
		stderr: process.stderr,
		argv: process.argv.slice(2),
		version,
	});
	process.exit(exitCode);
}
