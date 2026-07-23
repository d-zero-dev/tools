#!/usr/bin/env node
// Wire the `page-cluster` executable to the library's factory-based
// `resolvePageClusterKeys`. Reads JSONL from stdin (one page per line),
// writes JSONL to stdout (one cluster assignment per line, in input order),
// and streams progress to stderr via `@d-zero/dealer`'s `Lanes` — in-place
// animated header on a TTY, appended `[page-cluster] …` lines otherwise.

import type {
	PageClusterKeyResult,
	PageClusterSignals,
	ProgressEvent,
	ResolvePageClusterKeysOptions,
} from './resolve-page-cluster-keys.js';

import process from 'node:process';

import { Lanes } from '@d-zero/dealer';

import { resolvePageClusterKeys } from './resolve-page-cluster-keys.js';

/**
 * Parsed CLI shape. Kept as a plain record so tests can build it directly
 * without going through the argv parser.
 */
type CliArgs = {
	readonly contentBlockAttribute?: string;
	readonly includeLandmarkPositions?: boolean;
	readonly help?: boolean;
	readonly version?: boolean;
	readonly unknownFlag?: string;
};

const HELP_TEXT = `Usage:
  page-cluster [--content-block-attribute <name>] [--include-landmark-positions] < pages.jsonl > clusters.jsonl

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

  With --include-landmark-positions, each line additionally carries a
  \`landmarks\` field: every header/footer/nav/aside/form/search/main
  instance's position (1-based line/column plus string offsets), with the
  six excisable types (all but main) also carrying an \`isChrome\` verdict
  against that page's final cluster:
  {
    "id": "...", "clusterKey": "...",
    "landmarks": {
      "header": [{ "startLine": 1, "startColumn": 7, "endLine": 1,
                    "endColumn": 30, "startOffset": 6, "endOffset": 29,
                    "isChrome": true }],
      "footer": [...], "nav": [...], "aside": [...], "form": [...], "search": [...],
      "main": [{ "startLine": 2, "startColumn": 1, "endLine": 10,
                  "endColumn": 8, "startOffset": 40, "endOffset": 120 }]
    }
  }

Options:
  --content-block-attribute <name>   CMS-provided attribute marking freeform
                                     content blocks that should be stripped
                                     before comparison (e.g. \`data-bgb\`).
  --include-landmark-positions       Add the \`landmarks\` field described
                                     above to every output line. Not
                                     supported for corpora over 20,000 pages
                                     (throws instead of streaming). Disables
                                     progress output on stderr — this option
                                     always routes through the same
                                     non-progress-emitting code path as a
                                     run without progress.
  --help                             Print this help and exit.
  --version                          Print the package version and exit.

Progress:
  Emitted to stderr while the run is in progress. On an interactive
  terminal, an in-place animated header shows the current phase and
  elapsed time. When stderr is not a TTY (redirected to a file, piped, or
  under CI), each phase transition is appended as a \`[page-cluster] …\`
  line so \`grep\` / \`awk\` stay trivial. Silence progress with
  \`2>/dev/null\`; the JSONL output on stdout is unaffected either way.
`;

/**
 * Log id used for the single-lane `lanes.update()` call under verbose mode.
 * Lanes was originally designed for one line per parallel worker; here we
 * only ever have one narrative line, so a fixed id is enough.
 */
const LANE_ID = 0;

/**
 * Prefix rendered ahead of every verbose progress line. Set on `lanes.header`
 * at CLI init so that `lanes.update(LANE_ID, …)` under Lanes' verbose mode
 * emits `[page-cluster] <line>` rather than the `undefined <line>` string
 * it would produce with an unset header (see `dealer/lanes.ts:104`).
 */
const VERBOSE_HEADER = '[page-cluster]';

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
		includeLandmarkPositions?: boolean;
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
			case '--include-landmark-positions': {
				out.includeLandmarkPositions = true;
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
					`failed to parse JSONL line ${lineNo}: ${(error as Error).message}`,
				);
			}
			if (typeof entry.html !== 'string') {
				throw new TypeError(`JSONL line ${lineNo} is missing a string \`html\` field`);
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
				`failed to parse final JSONL line ${lineNo}: ${(error as Error).message}`,
			);
		}
		if (typeof entry.html !== 'string') {
			throw new TypeError(`JSONL line ${lineNo} is missing a string \`html\` field`);
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
 * TTY / verbose text pair for one progress moment. `renderProgress` picks
 * one arm depending on `useTty`. Keeping the two strings together at the
 * call site avoids threading a `useTty` flag into every message-shaping
 * helper.
 */
type ProgressLine = { readonly tty: string; readonly verbose: string };

/**
 * Renders the current lane message via TTY header or verbose-appended line
 * depending on the `useTty` mode. Wraps both `lanes.header()` and
 * `lanes.update(LANE_ID, …)` because — as documented in `dealer/lanes.ts` —
 * `header()` under verbose is a state-only setter that produces no output,
 * so verbose runs must go through `update()` to actually emit a line.
 * @param lanes
 * @param useTty
 * @param line
 */
function renderProgress(lanes: Lanes, useTty: boolean, line: ProgressLine): void {
	if (useTty) {
		lanes.header(line.tty);
	} else {
		lanes.update(LANE_ID, line.verbose);
	}
}

/**
 * Human-facing wording for the "reading input pages" moment (before stdin
 * is fully consumed). Verbose lines omit the `[page-cluster]` prefix — it
 * is applied once via `VERBOSE_HEADER` when Lanes constructs each verbose
 * line.
 */
const READING_INPUT: ProgressLine = {
	tty: '%earth% page-cluster — reading input...',
	verbose: 'reading input pages...',
};

/**
 * Progress line emitted after stdin is fully consumed, before the async
 * factory-based `resolvePageClusterKeys` starts producing events.
 * @param pageCount
 */
function readingDoneLine(pageCount: number): ProgressLine {
	return {
		tty: `%earth% page-cluster — read ${pageCount} pages, clustering...`,
		verbose: `read ${pageCount} pages, clustering...`,
	};
}

/**
 * Final summary line rendered right before `lanes.close()`.
 * @param pageCount
 * @param clusterCount
 * @param elapsedSec
 */
function doneLine(
	pageCount: number,
	clusterCount: number,
	elapsedSec: number,
): ProgressLine {
	const body = `${pageCount} pages in ${clusterCount} clusters (elapsed ${elapsedSec}s)`;
	return {
		tty: `page-cluster — done: ${body}`,
		verbose: `done — ${body}`,
	};
}

/**
 * Fatal-error line rendered via Lanes rather than a direct
 * `stderr.write` — the interactive Display's `close()` runs a
 * CURSOR_UP + ERASE_DOWN repaint that would wipe any raw stderr write
 * emitted before it, silently swallowing the diagnostic in TTY mode.
 * Sending the error through Lanes puts it into the final repainted
 * frame, so it survives `close()`.
 * @param message
 */
function errorLine(message: string): ProgressLine {
	return {
		tty: `page-cluster: ${message}`,
		verbose: `error: ${message}`,
	};
}

/**
 * Maps a library `ProgressEvent` to a human-facing `ProgressLine`. The
 * verbose arm keeps the historical `pass0:` / `pass1:` / `pass1b:` /
 * `stage-b:` phase tokens so callers who grep stderr by phase name (a
 * pattern the earlier `formatProgress` documented) stay compatible; TTY
 * lines use natural-language wording since interactive users read the
 * header, not grep.
 * @param event
 * @param elapsedSec
 */
function formatProgressLine(event: ProgressEvent, elapsedSec: number): ProgressLine {
	switch (event.phase) {
		case 'pass0-signals': {
			return {
				tty: `%earth% page-cluster — reading signals: ${event.pagesSeen} pages (elapsed ${elapsedSec}s)`,
				verbose: `pass0: ${event.pagesSeen} pages read`,
			};
		}
		case 'pass1-block-complete': {
			return {
				tty: `%earth% page-cluster — clustering ${event.blocksProcessed}/${event.totalBlocks} blocks (elapsed ${elapsedSec}s)`,
				verbose: `pass1: clustered block ${event.blocksProcessed}/${event.totalBlocks}`,
			};
		}
		case 'pass1b-assign': {
			return {
				tty: `%earth% page-cluster — assigning pages: ${event.pagesAssigned}/${event.pagesToAssign} (elapsed ${elapsedSec}s)`,
				verbose: `pass1b: ${event.pagesAssigned}/${event.pagesToAssign} pages assigned`,
			};
		}
		case 'stage-b-start': {
			return {
				tty: `%earth% page-cluster — merging ${event.unitCount} units (elapsed ${elapsedSec}s)`,
				verbose: `stage-b: merging ${event.unitCount} units`,
			};
		}
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

	// TTY detection: `NodeJS.WritableStream` doesn't expose `isTTY`, but the
	// concrete `WriteStream` (and the in-memory `Writable` collectors tests
	// pass in) does — reading it defensively lets both real usage and
	// unit-test doubles work without a separate `--no-progress` flag.
	const useTty = (options.stderr as { isTTY?: boolean }).isTTY === true;
	const lanes = new Lanes({ stream: options.stderr, verbose: !useTty });
	// Verbose Lanes prepends `#header` to every `update()` line. Without
	// this seed call the header would be undefined and each progress line
	// would begin with the literal string `undefined ` — bug caught by
	// code-review high effort. TTY mode overwrites the header per event
	// so the seed value is only surfaced verbatim under verbose.
	if (!useTty) {
		lanes.header(VERBOSE_HEADER);
	}
	const startTime = Date.now();
	const elapsed = () => Math.max(0, Math.round((Date.now() - startTime) / 1000));

	// Every early return past this point must run through the finally block
	// so `lanes.close()` releases the display's setTimeout timer — without
	// it a `return 1` on a stdin parse error would leave the process
	// hanging on the timer's next tick.
	try {
		renderProgress(lanes, useTty, READING_INPUT);

		// Load every JSONL line into memory once so the ids array stays
		// parallel to the pages array — the streaming driver reads its
		// factory twice, and stdin is a one-shot pipe.
		const ids: (string | number | undefined)[] = [];
		const pages: PageClusterSignals[] = [];
		try {
			for await (const { id, page } of readJsonlPages(options.stdin)) {
				ids.push(id);
				pages.push(page);
			}
		} catch (error) {
			renderProgress(lanes, useTty, errorLine((error as Error).message));
			return 1;
		}

		renderProgress(lanes, useTty, readingDoneLine(pages.length));

		const resolveOptions: ResolvePageClusterKeysOptions = {
			contentBlockAttribute: args.contentBlockAttribute,
			onProgress: (event) => {
				renderProgress(lanes, useTty, formatProgressLine(event, elapsed()));
			},
		};

		// `includeLandmarkPositions` always routes resolvePageClusterKeys
		// through its non-progress-emitting sync path (see that option's own
		// JSDoc), so the onProgress callback above is set but never invoked
		// in this branch — no separate "quiet" resolveOptions variant needed.
		let clusterKeys: string[];
		let landmarksByIndex: PageClusterKeyResult['landmarks'][] | undefined;
		try {
			if (args.includeLandmarkPositions) {
				const results = await resolvePageClusterKeys(() => pages, {
					...resolveOptions,
					includeLandmarkPositions: true,
				});
				clusterKeys = results.map((r) => r.clusterKey);
				landmarksByIndex = results.map((r) => r.landmarks);
			} else {
				clusterKeys = await resolvePageClusterKeys(() => pages, resolveOptions);
			}
		} catch (error) {
			renderProgress(lanes, useTty, errorLine((error as Error).message));
			return 1;
		}

		const clusterCount = new Set(clusterKeys).size;
		renderProgress(lanes, useTty, doneLine(pages.length, clusterCount, elapsed()));

		for (const [index, key] of clusterKeys.entries()) {
			const row: { id: string | number; clusterKey: string; landmarks?: unknown } = {
				id: ids[index] ?? index,
				clusterKey: key,
			};
			if (landmarksByIndex) row.landmarks = landmarksByIndex[index];
			options.stdout.write(`${JSON.stringify(row)}\n`);
		}
		return 0;
	} finally {
		lanes.close();
	}
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
