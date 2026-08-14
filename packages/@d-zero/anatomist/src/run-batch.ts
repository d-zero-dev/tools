import type { AnalyzePageLayoutOptions } from './analyze-page-layout.js';
import type { LayoutAnalysisResult } from './types.js';
import type { DealHeader } from '@d-zero/dealer';

import { deal } from '@d-zero/dealer';
import { launch } from 'puppeteer';

import { analyzePageLayout } from './analyze-page-layout.js';

export type RunBatchOptions = AnalyzePageLayoutOptions & {
	/** Number of URLs processed concurrently, each in its own tab of one shared browser process. Default `1`. */
	concurrency?: number;
	/** Called once per `(url, viewport)` result, as soon as it's ready — lets the caller stream output rather than buffering the whole batch. */
	onResult?: (result: LayoutAnalysisResult) => void;
	/** Called once per URL that fails to analyze, instead of aborting the batch. */
	onError?: (url: string, error: unknown) => void;
	/** Where `deal()`'s progress display writes. Default `process.stderr`. */
	stderr?: NodeJS.WritableStream;
};

/** One item processed by `deal()`. `deal` requires `WeakKey` items, so a bare `string[]` of URLs can't be passed directly. */
type UrlItem = { readonly index: number; readonly url: string };

const HEADER: DealHeader = (_progress, done, total) =>
	`%earth% anatomist — analyzing ${done}/${total}`;

/**
 * Analyzes many URLs concurrently, each in its own tab of one shared
 * headless browser (a single `launch()` call for the whole batch —
 * `@d-zero/puppeteer-dealer`'s multi-process fan-out is unnecessary here
 * since a tab, not a process, is the unit of isolation this tool needs).
 * @param urls
 * @param options
 * @example
 * ```ts
 * await runBatch(['https://a.example/', 'https://b.example/'], {
 *   concurrency: 2,
 *   onResult: (result) => console.log(JSON.stringify(result)),
 * });
 * ```
 */
export async function runBatch(
	urls: readonly string[],
	options: RunBatchOptions = {},
): Promise<void> {
	// `await using` により、deal() が例外を投げてもブラウザが確実に閉じられる。
	// puppeteer の Browser/Page は Symbol.asyncDispose をネイティブ実装している
	// （型定義上の対応は puppeteer 25.5.0 以降）。
	await using browser = await launch({ headless: true });
	const items: UrlItem[] = urls.map((url, index) => ({ index, url }));

	await deal(
		items,
		({ url }, update) => {
			return async () => {
				update(`analyzing ${url}`);
				await using page = await browser.newPage();
				try {
					const results = await analyzePageLayout(page, url, options);
					for (const result of results) {
						options.onResult?.(result);
					}
				} catch (error) {
					options.onError?.(url, error);
				}
			};
		},
		{
			header: HEADER,
			// Clamp to 1: `Dealer`'s worker loop (`while (this.#workers.size <
			// this.#limit)`) never launches a worker when `limit` is `0`, and
			// `?? 1` alone doesn't catch that — nullish coalescing only
			// replaces `null`/`undefined`, not an explicit `0` such as
			// `--concurrency 0` would parse to. Without this clamp, a `0`
			// hangs the whole run with no output and no error.
			limit: Math.max(1, options.concurrency ?? 1),
			stream: options.stderr,
		},
	);
}
