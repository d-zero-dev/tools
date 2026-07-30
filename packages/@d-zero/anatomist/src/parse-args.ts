import type { InnerHtmlMode } from './format-output.js';
import type { UrlListFormat } from './parse-url-list.js';

/**
 * Parsed CLI shape. Kept as a plain record so tests can build it directly
 * without going through the argv parser (pattern shared with
 * `@d-zero/page-cluster`'s `CliArgs`).
 */
export type CliArgs = {
	readonly input?: string;
	readonly inputFormat: UrlListFormat;
	readonly mainSelector?: string;
	readonly viewports: readonly string[];
	readonly maxDepth?: number;
	readonly minArea?: number;
	readonly innerHtml: InnerHtmlMode;
	readonly noBoundingBox: boolean;
	readonly concurrency?: number;
	readonly timeout?: number;
	readonly maxScrollHeight?: number;
	readonly out?: string;
	readonly pretty: boolean;
	readonly help?: boolean;
	readonly version?: boolean;
	readonly unknownFlag?: string;
};

/**
 * @param argv
 * @param index
 */
function requireValue(argv: readonly string[], index: number): string | undefined {
	return argv[index + 1];
}

/**
 * @param argv
 * @param index
 */
function requireNumber(argv: readonly string[], index: number): number | undefined {
	const raw = argv[index + 1];
	if (raw === undefined) {
		return undefined;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Parses `process.argv`-style arguments (already sliced past `node script`)
 * into a `CliArgs`. Deliberately tolerant of an unknown flag so the caller
 * can decide the error message shape (pattern shared with
 * `@d-zero/page-cluster`'s `parseArgs`).
 * @param argv
 */
export function parseArgs(argv: readonly string[]): CliArgs {
	const out: {
		input?: string;
		inputFormat: UrlListFormat;
		mainSelector?: string;
		viewports: string[];
		maxDepth?: number;
		minArea?: number;
		innerHtml: InnerHtmlMode;
		noBoundingBox: boolean;
		concurrency?: number;
		timeout?: number;
		maxScrollHeight?: number;
		out?: string;
		pretty: boolean;
		help?: boolean;
		version?: boolean;
		unknownFlag?: string;
	} = {
		inputFormat: 'lines',
		viewports: [],
		innerHtml: 'all',
		noBoundingBox: false,
		pretty: false,
	};

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
			case '--input':
			case '-f': {
				const next = requireValue(argv, i);
				if (next === undefined) {
					out.unknownFlag = `${arg} requires a value`;
					return out;
				}
				out.input = next;
				i++;
				break;
			}
			case '--input-format': {
				const next = requireValue(argv, i);
				if (next !== 'lines' && next !== 'json') {
					out.unknownFlag = `${arg} requires "lines" or "json"`;
					return out;
				}
				out.inputFormat = next;
				i++;
				break;
			}
			case '--main-selector': {
				const next = requireValue(argv, i);
				if (next === undefined) {
					out.unknownFlag = `${arg} requires a value`;
					return out;
				}
				out.mainSelector = next;
				i++;
				break;
			}
			case '--viewport': {
				const next = requireValue(argv, i);
				if (next === undefined) {
					out.unknownFlag = `${arg} requires a value`;
					return out;
				}
				out.viewports.push(next);
				i++;
				break;
			}
			case '--max-depth': {
				const value = requireNumber(argv, i);
				if (value === undefined) {
					out.unknownFlag = `${arg} requires a number`;
					return out;
				}
				out.maxDepth = value;
				i++;
				break;
			}
			case '--min-area': {
				const value = requireNumber(argv, i);
				if (value === undefined) {
					out.unknownFlag = `${arg} requires a number`;
					return out;
				}
				out.minArea = value;
				i++;
				break;
			}
			case '--inner-html': {
				const next = requireValue(argv, i);
				if (next !== 'all' && next !== 'leaf-only' && next !== 'none') {
					out.unknownFlag = `${arg} requires "all", "leaf-only", or "none"`;
					return out;
				}
				out.innerHtml = next;
				i++;
				break;
			}
			case '--no-bounding-box': {
				out.noBoundingBox = true;
				break;
			}
			case '--concurrency': {
				const value = requireNumber(argv, i);
				if (value === undefined) {
					out.unknownFlag = `${arg} requires a number`;
					return out;
				}
				out.concurrency = value;
				i++;
				break;
			}
			case '--timeout': {
				const value = requireNumber(argv, i);
				if (value === undefined) {
					out.unknownFlag = `${arg} requires a number`;
					return out;
				}
				out.timeout = value;
				i++;
				break;
			}
			case '--max-scroll-height': {
				const value = requireNumber(argv, i);
				if (value === undefined) {
					out.unknownFlag = `${arg} requires a number`;
					return out;
				}
				out.maxScrollHeight = value;
				i++;
				break;
			}
			case '--out': {
				const next = requireValue(argv, i);
				if (next === undefined) {
					out.unknownFlag = `${arg} requires a value`;
					return out;
				}
				out.out = next;
				i++;
				break;
			}
			case '--pretty': {
				out.pretty = true;
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
