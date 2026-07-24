import type { BlockingReason } from './derive-blocking-reason.js';
import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';

import { filterFirstPartyStylesheetHrefs } from './filter-first-party-stylesheet-hrefs.js';
import {
	REASSIGNED_KEY_PREFIX,
	reassignOrphanBlockKeys,
} from './reassign-orphan-block-keys.js';
import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';

/**
 * The corpus-wide, HTML-free inputs needed by
 * {@link ./pass0-blocking.js | resolveBlockKeys}: the blocking signals plus
 * the page's own URL host. The full `PageClusterSignals` type carries `html`
 * on top of these, but Pass 0 deliberately does not read HTML — the whole
 * point of extracting the blocking step is that it can be run before any
 * per-page HTML is held in memory.
 */
export type Pass0PageSignals = {
	readonly paths: readonly string[];
	readonly stylesheetHrefs: readonly string[];
	readonly host?: string;
};

/**
 * @see resolveBlockKeys
 */
export type ResolveBlockKeysOptions = ResolveBlockingGroupKeysOptions & {
	/**
	 * Apply {@link ./reassign-orphan-block-keys.js | reassignOrphanBlockKeys}
	 * to the blocking keys, so a page with no recorded stylesheets can rejoin
	 * a same-URL-section `css:` block instead of being stranded on its weaker
	 * `path:` fallback. Defaults to `true`.
	 */
	readonly reassignOrphans?: boolean;
	/**
	 * Apply {@link ./filter-first-party-stylesheet-hrefs.js |
	 * filterFirstPartyStylesheetHrefs} to `pages` before computing blocking
	 * keys, so a page's incidental third-party embeds do not contaminate the
	 * blocking signal. Defaults to `true`.
	 */
	readonly restrictStylesheetsToFirstParty?: boolean;
};

/** Return shape when `includeReasons: true` is passed to `resolveBlockKeys`. */
export type BlockKeysWithReasons = {
	readonly blockKeys: string[];
	/** One entry per distinct final block key produced, keyed by that key. */
	readonly reasonsByBlockKey: ReadonlyMap<string, BlockingReason>;
};

/**
 * Splits `resolvePageClusterKeys` into a size-flat first pass so the driver
 * can decide per-block memory strategy before loading any page HTML. Runs the
 * three corpus-wide, HTML-free stages of blocking in the same order the
 * in-memory driver already uses — first-party stylesheet filtering, blocking-
 * key derivation, orphan reassignment — and returns one final block key per
 * input page in input order.
 *
 * ## Why extract this from resolvePageClusterKeys?
 *
 * The in-memory driver holds every page's `html`, `remainderHtml`,
 * `landmarks[]`, and pre-Stage-A prepared HTML at once. At 176k pages × ~57
 * KB average, that alone breaks a 17 GB RAM machine well before Stage A
 * starts (measured: OS SIGKILL at ~15,000 pages, before the resolve phase
 * even began). All three blocking stages, in contrast, depend only on
 * `paths` / `stylesheetHrefs` / `host` — a few hundred bytes per page. Running
 * them first, HTML-free, lets the downstream per-block clustering hold HTML
 * for only one block's pages at a time.
 *
 * ## Preserves in-memory driver semantics exactly
 *
 * The output of this function is byte-identical to the block-key portion of
 * the current `resolvePageClusterKeys` for the same input, because it reuses
 * the same three underlying functions in the same order with the same
 * defaults. That guarantee is load-bearing: the size-threshold-gated Pass 1
 * that follows this function runs the current in-memory implementation
 * unchanged for small blocks, and any drift in block-key computation between
 * Pass 0 and Pass 1 would silently misroute pages between the two paths.
 * @param pages
 * @param options
 * @example
 * ```ts
 * const blockKeys = resolveBlockKeys([
 *   { paths: ['news', '1'], stylesheetHrefs: ['/a.css'], host: 'example.com' },
 *   { paths: ['news', '2'], stylesheetHrefs: ['/a.css'], host: 'example.com' },
 *   { paths: ['about'],     stylesheetHrefs: [],        host: 'example.com' },
 * ]);
 * // ['css:<hash>', 'css:<hash>', 'path:about']
 * ```
 */
export function resolveBlockKeys(
	pages: readonly Pass0PageSignals[],
	options: ResolveBlockKeysOptions & { includeReasons: true },
): BlockKeysWithReasons;
export function resolveBlockKeys(
	pages: readonly Pass0PageSignals[],
	options?: ResolveBlockKeysOptions,
): string[];
export function resolveBlockKeys(
	pages: readonly Pass0PageSignals[],
	options?: ResolveBlockKeysOptions & { includeReasons?: boolean },
): string[] | BlockKeysWithReasons {
	const restrictStylesheetsToFirstParty =
		options?.restrictStylesheetsToFirstParty ?? true;
	const blockingPages = restrictStylesheetsToFirstParty
		? filterFirstPartyStylesheetHrefs(pages)
		: pages;

	// Orphan reassignment always uses a numeric `pathDepth`. When the caller
	// asked for `'auto'`, fall back to the historical default 1 here — a
	// future PR that wires the auto-cut depth through can compute it once
	// and pass it as a number to both `resolveBlockingGroupKeys` and this
	// call to keep them consistent.
	const numericPathDepth =
		typeof options?.pathDepth === 'number' ? options.pathDepth : undefined;
	const reassignOrphans = options?.reassignOrphans ?? true;

	if (!options?.includeReasons) {
		const rawBlockKeys = resolveBlockingGroupKeys(blockingPages, options);
		if (!reassignOrphans) return rawBlockKeys;
		return reassignOrphanBlockKeys(blockingPages, rawBlockKeys, numericPathDepth);
	}

	const { keys: rawBlockKeys, reasonsByKey } = resolveBlockingGroupKeys(blockingPages, {
		...options,
		includeReasons: true,
	});
	if (!reassignOrphans) {
		return { blockKeys: rawBlockKeys, reasonsByBlockKey: reasonsByKey };
	}

	const finalBlockKeys = reassignOrphanBlockKeys(
		blockingPages,
		rawBlockKeys,
		numericPathDepth,
	);
	const reasonsByBlockKey = new Map<string, BlockingReason>(reasonsByKey);
	for (const blockKey of finalBlockKeys) {
		if (reasonsByBlockKey.has(blockKey)) continue;
		reasonsByBlockKey.set(blockKey, {
			kind: 'orphanMerge',
			pathKey: blockKey.slice(REASSIGNED_KEY_PREFIX.length),
		});
	}
	return { blockKeys: finalBlockKeys, reasonsByBlockKey };
}

/**
 * Groups pages by their block key while preserving each block's members in
 * input order. Returned as a `Map` so the caller can iterate blocks in
 * insertion order (first-seen block first) — matching the order
 * `resolvePageClusterKeys`'s own per-block loop already uses so cluster IDs
 * assigned per block stay deterministic across in-memory and streaming
 * paths.
 * @param blockKeys
 * @example
 * ```ts
 * const indices = groupIndicesByBlockKey(['a', 'b', 'a', 'c', 'a']);
 * // Map { 'a' => [0, 2, 4], 'b' => [1], 'c' => [3] }
 * ```
 */
export function groupIndicesByBlockKey(
	blockKeys: readonly string[],
): Map<string, number[]> {
	const groups = new Map<string, number[]>();
	for (const [index, blockKey] of blockKeys.entries()) {
		const list = groups.get(blockKey);
		if (list) {
			list.push(index);
		} else {
			groups.set(blockKey, [index]);
		}
	}
	return groups;
}
