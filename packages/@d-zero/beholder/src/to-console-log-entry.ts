import type { ConsoleLogEntry } from './types.js';
import type { ConsoleMessage } from 'puppeteer';

/**
 * Converts a Puppeteer `ConsoleMessage` into a `ConsoleLogEntry`.
 *
 * WHY per-argument try/catch: `JSHandle.jsonValue()` can reject when the
 * page's execution context has been destroyed (e.g. mid-navigation) or when
 * the value cannot be serialized (e.g. a circular reference). A single
 * failing argument must not drop the rest of the message's arguments.
 * @param msg - The console message captured via `page.on('console')`
 * @param pageUrl - The URL (without hash) of the page that produced the message
 * @returns The resolved console log entry
 */
export async function toConsoleLogEntry(
	msg: ConsoleMessage,
	pageUrl: string,
): Promise<ConsoleLogEntry> {
	const args = await Promise.all(
		msg.args().map(async (arg) => {
			try {
				return await arg.jsonValue();
			} catch {
				return;
			} finally {
				await arg.dispose().catch(() => {});
			}
		}),
	);
	const loc = msg.location();

	return {
		pageUrl,
		type: msg.type(),
		text: msg.text(),
		args,
		location: loc.url === undefined ? undefined : loc,
		ts: Date.now(),
	};
}
