/**
 * Public, Puppeteer-free entry point for extracting {@link Meta} from an
 * already-parsed DOM (e.g. jsdom).
 *
 * WHY this exists alongside `Scraper.scrapeStart()` / `getMeta(page, …)`:
 * callers who already have an HTML string (from `fetch`, a fixture, an
 * archive) should not be forced to spin up Chromium just to read a few `<meta>`
 * tags. This module reuses the same `collectHead → detectTags → classify`
 * pipeline as the Puppeteer path — the `Meta` shape returned here is
 * identical to what `Scraper` produces, so downstream consumers do not branch
 * on the source.
 *
 * See {@link extractMetaFromDocument} for the usage example.
 * @module
 */

import type { Meta } from './types.js';

import { classify } from './meta/classify.js';
import { collectHeadFromDocument, WINDOW_GLOBALS_TO_CHECK } from './meta/collect-head.js';
import { detectTags } from './meta/tag-detection.js';

/**
 * Inputs for {@link extractMetaFromDocument}.
 *
 * `url`/`statusCode`/`headers` mirror the inputs to the underlying
 * `simple-wappalyzer` driver. They are not consumed by the DOM-walk side of
 * the pipeline.
 *
 * `html` is optional: when omitted, `document.documentElement.outerHTML` is
 * read off the passed window — matching the fallback `getMeta(page, …)` does
 * via `page.content()`.
 */
export type ExtractMetaContext = {
	/** The fully resolved URL of the page (used by Wappalyzer + AMP fields). */
	readonly url: string;
	/**
	 * Rendered HTML used for technology detection. Defaults to
	 * `window.document.documentElement.outerHTML` when omitted.
	 *
	 * WHY allow override: callers that fetched the raw HTML string from the
	 * network already have the *pre-script-execution* markup, which is what
	 * Wappalyzer's HTML patterns are tuned for. The serialized DOM from
	 * `outerHTML` reflects whatever scripts have already mutated; provide the
	 * raw string to get more stable detections.
	 */
	readonly html?: string;
	/** HTTP status code, surfaced to the Wappalyzer driver. */
	readonly statusCode?: number;
	/**
	 * Response headers; case is preserved by the caller, lowercased internally
	 * by `detectTags`.
	 */
	readonly headers?: Record<string, string | string[] | undefined>;
	/**
	 * When `true`, the returned `Meta` includes `_raw: RawHeadEntry[]` for
	 * debugging. Default `false` to keep the serialized payload small.
	 */
	readonly includeRaw?: boolean;
};

/**
 * Extracts a `Meta` object from a DOM provided by the caller.
 *
 * Pipeline:
 *
 * 1. {@link collectHeadFromDocument} walks `window.document` and returns a
 *    serializable `RawHeadEntry[]`.
 * 2. {@link detectTags} runs `simple-wappalyzer` over the HTML + headers to
 *    detect third-party technologies.
 * 3. {@link classify} folds the two signals together into a typed `Meta`.
 *
 * Step (1) is synchronous and runs first; step (2) is awaited next. The two
 * are independent in principle, but the current shape is sequential — keeping
 * it that way avoids forcing the synchronous DOM walk into a microtask just to
 * gain a few milliseconds of overlap with the Wappalyzer call.
 * @param window - The window whose `document` will be walked. jsdom's
 *                 `dom.window` works; pass any object satisfying the `Window`
 *                 type. The function never mutates the document.
 * @param context - URL / HTML / headers / status code context. See
 *                  {@link ExtractMetaContext}.
 * @returns The extracted `Meta` (always defined; empty fields stay empty).
 * @example
 * ```ts
 * import { JSDOM } from 'jsdom';
 * import { extractMetaFromDocument } from '@d-zero/beholder';
 *
 * const url = 'https://example.com/';
 * const html = await (await fetch(url)).text();
 * const dom = new JSDOM(html, { url });
 *
 * // The `as unknown as Window` cast is needed because jsdom's `DOMWindow` is
 * // not structurally identical to lib.dom's `Window` (a few rare globals
 * // differ), but the runtime shape is compatible for this function's needs.
 * const meta = await extractMetaFromDocument(dom.window as unknown as Window, {
 *   url,
 *   html,
 * });
 *
 * meta.title;         // <title>
 * meta.og?.image;     // og:image[]
 * meta.tags.entries;  // Wappalyzer detections + extracted IDs
 * ```
 */
export async function extractMetaFromDocument(
	window: Window,
	context: ExtractMetaContext,
): Promise<Meta> {
	const raw = collectHeadFromDocument(window, WINDOW_GLOBALS_TO_CHECK);
	const html = context.html ?? window.document.documentElement.outerHTML;
	const tags = await detectTags({
		url: context.url,
		html,
		...(context.statusCode === undefined ? {} : { statusCode: context.statusCode }),
		...(context.headers === undefined ? {} : { headers: context.headers }),
	});
	return classify(raw, {
		tags,
		...(context.includeRaw ? { includeRaw: true } : {}),
	});
}
