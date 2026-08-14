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
				// Why not `await using`: dispose() が reject すると SuppressedError に
				// 包まれ、本来無視したいだけの dispose 失敗が呼び出し元へ伝播してしまう。
				// ここでは jsonValue() の結果を最優先し、dispose の失敗は握りつぶす
				// 現状の挙動を維持する。
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
