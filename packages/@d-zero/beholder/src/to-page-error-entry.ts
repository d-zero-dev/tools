import type { ConsoleLogEntry } from './types.js';

/**
 * Converts an uncaught exception / unhandled Promise rejection (captured via
 * `page.on('pageerror')`) into a `ConsoleLogEntry`.
 * @param error - The value emitted by `page.on('pageerror')`; typed as `unknown`
 * because Puppeteer allows non-`Error` throw values (e.g. `throw 'oops'`)
 * @param pageUrl - The URL (without hash) of the page that produced the error
 * @returns The console log entry, with `type: 'pageerror'`
 */
export function toPageErrorEntry(error: unknown, pageUrl: string): ConsoleLogEntry {
	const isErr = error instanceof Error;

	return {
		pageUrl,
		type: 'pageerror',
		text: isErr ? error.message : String(error),
		args: [],
		stack: isErr ? error.stack : undefined,
		ts: Date.now(),
	};
}
