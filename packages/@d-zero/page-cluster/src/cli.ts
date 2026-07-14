#!/usr/bin/env node
// Wire the `page-cluster` executable to the library's factory-based
// `resolvePageClusterKeys`. Reads JSONL from stdin (one page per line),
// writes JSONL to stdout (one cluster assignment per line, in input order),
// and streams progress to stderr.

import type {
	PageClusterSignals,
	ProgressEvent,
	ResolvePageClusterKeysOptions,
} from './resolve-page-cluster-keys.js';

import process from 'node:process';

import { resolvePageClusterKeys } from './resolve-page-cluster-keys.js';

/**
 * Parsed CLI shape. Kept as a plain record so tests can build it directly
 * without going through the argv parser.
 */
type CliArgs = {
	readonly contentBlockAttribute?: string;
	readonly help?: boolean;
	readonly version?: boolean;
	readonly unknownFlag?: string;
};

const HELP_TEXT = `Usage:
  page-cluster [--content-block-attribute <name>] < pages.jsonl > clusters.jsonl

Input (JSONL, one page per line):
  {
    "id": "any stable identifier",
    "html": "<html>...</html>",
    "paths": ["news", "1"],            // optional
    "stylesheetHrefs": ["/a.css"],     // optional
    "host": "example.com"              // optional
  }

Output (JSONL, one line per input page, in input order):
  { "id": "...", "clusterKey": "..." }

Options:
  --content-block-attribute <name>   CMS-provided attribute marking freeform
                                     content blocks that should be stripped
                                     before comparison (e.g. \`data-bgb\`).
  --help                             Print this help and exit.
  --version                          Print the package version and exit.

Progress:
  Emitted to stderr as \`[page-cluster] <event>\` lines while the run is in
  progress. Piping stderr to /dev/null silences them; the JSONL output on
  stdout is unaffected.
`;

/**
 * Parses `process.argv`-style arguments (already sliced past `node script`)
 * into a `CliArgs`. Deliberately tolerant of an unknown flag so the caller
 * can decide the error message shape, and so tests can assert on the
 * unrecognized flag name directly.
 * @param argv
 */
export function parseArgs(argv: readonly string[]): CliArgs {
	const out: {
		contentBlockAttribute?: string;
		help?: boolean;
		version?: boolean;
		unknownFlag?: string;
	} = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		switch (arg) {
			case '--help':
			case '-h': {
				out.help = true;
				break;
			}
			case '--version':
			case '-v': {
				out.version = true;
				break;
			}
			case '--content-block-attribute': {
				const next = argv[i + 1];
				if (next === undefined) {
					out.unknownFlag = `${arg} requires a value`;
					return out;
				}
				out.contentBlockAttribute = next;
				i++;
				break;
			}
			default: {
				out.unknownFlag = arg;
				return out;
			}
		}
	}
	return out;
}

/**
 * Renders a {@link ./resolve-page-cluster-keys.js | ProgressEvent} as a
 * single stderr line. Format is intentionally line-oriented and
 * self-descriptive so that piping to `grep` / `awk` stays trivial.
 * @param event
 */
function formatProgress(event: ProgressEvent): string {
	switch (event.phase) {
		case 'pass0-signals': {
			return `[page-cluster] pass0: ${event.pagesSeen} pages read\n`;
		}
		case 'pass1-block-complete': {
			return `[page-cluster] pass1: block ${event.blocksProcessed}/${event.totalBlocks} complete\n`;
		}
		case 'pass1b-assign': {
			return `[page-cluster] pass1b: ${event.pagesAssigned}/${event.pagesToAssign} pages assigned\n`;
		}
		case 'stage-b-start': {
			return `[page-cluster] stage-b: merging ${event.unitCount} unit(s)\n`;
		}
	}
}

/**
 * Streams `stdin` and yields per-line JSON-parsed page objects (plus the
 * original line's `id`, preserved for the output row). Chunk-boundary
 * splitting is done by hand rather than via `readline` because certain
 * multi-KB UTF-8 lines have been observed to trip `readline`'s parser on
 * this codebase — see `.page-cluster/scale-spike.mjs`'s note for the
 * concrete case.
 * @param input
 */
async function* readJsonlPages(
	input: NodeJS.ReadableStream,
): AsyncGenerator<{ id: string | number | undefined; page: PageClusterSignals }> {
	input.setEncoding?.('utf8');
	let leftover = '';
	let lineNo = 0;
	for await (const chunk of input) {
		const text = leftover + (chunk as string);
		const parts = text.split('\n');
		leftover = parts.pop() ?? '';
		for (const line of parts) {
			lineNo++;
			if (line.length === 0) continue;
			let entry: {
				id?: string | number;
				html?: string;
				paths?: readonly string[];
				stylesheetHrefs?: readonly string[];
				host?: string;
			};
			try {
				entry = JSON.parse(line) as typeof entry;
			} catch (error) {
				throw new Error(
					`page-cluster: failed to parse JSONL line ${lineNo}: ${(error as Error).message}`,
				);
			}
			if (typeof entry.html !== 'string') {
				throw new TypeError(
					`page-cluster: JSONL line ${lineNo} is missing a string \`html\` field`,
				);
			}
			yield {
				id: entry.id,
				page: {
					html: entry.html,
					paths: entry.paths ?? [],
					stylesheetHrefs: entry.stylesheetHrefs ?? [],
					host: entry.host,
				},
			};
		}
	}
	if (leftover.length > 0) {
		lineNo++;
		let entry: {
			id?: string | number;
			html?: string;
			paths?: readonly string[];
			stylesheetHrefs?: readonly string[];
			host?: string;
		};
		try {
			entry = JSON.parse(leftover) as typeof entry;
		} catch (error) {
			throw new Error(
				`page-cluster: failed to parse final JSONL line ${lineNo}: ${(error as Error).message}`,
			);
		}
		if (typeof entry.html !== 'string') {
			throw new TypeError(
				`page-cluster: JSONL line ${lineNo} is missing a string \`html\` field`,
			);
		}
		yield {
			id: entry.id,
			page: {
				html: entry.html,
				paths: entry.paths ?? [],
				stylesheetHrefs: entry.stylesheetHrefs ?? [],
				host: entry.host,
			},
		};
	}
}

/**
 * Test-friendly entry point: takes the run's stdin/stdout/stderr streams
 * and the parsed CLI flags rather than reading them out of the process
 * globals. `runCli` returns the exit code, allowing the caller (either the
 * top-level `main` here or a spec test) to decide how to signal it.
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
			`page-cluster: unrecognized argument ${JSON.stringify(args.unknownFlag)}\n`,
		);
		options.stderr.write(HELP_TEXT);
		return 2;
	}

	// Load every JSONL line into memory once so the ids array stays parallel
	// to the pages array — the streaming driver reads its factory twice, and
	// stdin is a one-shot pipe.
	const ids: (string | number | undefined)[] = [];
	const pages: PageClusterSignals[] = [];
	try {
		for await (const { id, page } of readJsonlPages(options.stdin)) {
			ids.push(id);
			pages.push(page);
		}
	} catch (error) {
		options.stderr.write(`${(error as Error).message}\n`);
		return 1;
	}

	const resolveOptions: ResolvePageClusterKeysOptions = {
		contentBlockAttribute: args.contentBlockAttribute,
		onProgress: (event) => options.stderr.write(formatProgress(event)),
	};
	let keys: string[];
	try {
		keys = await resolvePageClusterKeys(() => pages, resolveOptions);
	} catch (error) {
		options.stderr.write(`page-cluster: ${(error as Error).message}\n`);
		return 1;
	}

	for (const [index, key] of keys.entries()) {
		options.stdout.write(
			`${JSON.stringify({ id: ids[index] ?? index, clusterKey: key })}\n`,
		);
	}
	return 0;
}

/**
 * Reads the package version out of `package.json` at runtime. Kept as a
 * separate helper so `runCli` can be exercised in tests without needing a
 * real `package.json` on disk.
 */
async function readPackageVersion(): Promise<string> {
	try {
		const url = new URL('../package.json', import.meta.url);
		const { readFile } = await import('node:fs/promises');
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
