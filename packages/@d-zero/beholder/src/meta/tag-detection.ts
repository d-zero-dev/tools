/**
 * Third-party tag detection layer.
 *
 * Combines two signals to populate {@link TagsMeta}:
 * 1. `simple-wappalyzer` runs over the page HTML + headers to identify
 *    the technologies present (and their Wappalyzer categories).
 * 2. {@link extractIds} from `./id-extractors.js` finds the real account
 *    / measurement IDs (e.g. `G-XXXXXXXX`, `GTM-XXXXX`) for each detected
 *    provider.
 *
 * Returned shape is documented on {@link TagsMeta} in `./types.ts`.
 * @module
 */

import type { TagDetail, TagEntry, TagsMeta } from './types.js';

import wappalyzer from 'simple-wappalyzer';

import { domLog } from '../debug.js';

import { extractIds } from './id-extractors.js';

const log = domLog.extend(`${process.pid}`);

/**
 * Shape of a single technology entry returned by `simple-wappalyzer`.
 * Mirrors the subset of fields we use; everything else is ignored.
 */
interface WappalyzerTech {
	readonly name: string;
	readonly version?: string;
	readonly confidence?: number;
	readonly categories?: ReadonlyArray<{ readonly name?: string; readonly id?: number }>;
}

/**
 * Inputs required to drive `simple-wappalyzer`.
 *
 * `headers` keys should be lowercase; `simple-wappalyzer` is case-insensitive
 * but normalizing up front avoids ambiguity.
 */
export type DetectTagsInput = {
	readonly url: string;
	readonly html: string;
	readonly statusCode?: number;
	readonly headers?: Record<string, string | string[] | undefined>;
};

const EMPTY_TAGS: TagsMeta = { detected: {}, entries: [] };

/**
 * Drives `simple-wappalyzer` and post-processes the result with the
 * provider-specific ID extractors. Failures fall back to an empty `TagsMeta`
 * rather than throwing, so the caller does not need to wrap the call.
 * @param input
 */
export async function detectTags(input: DetectTagsInput): Promise<TagsMeta> {
	const headers = normalizeHeaders(input.headers);
	let detections: WappalyzerTech[];
	try {
		const result = (await wappalyzer({
			url: input.url,
			html: input.html,
			headers,
		})) as unknown;
		detections = Array.isArray(result) ? (result as WappalyzerTech[]) : [];
	} catch (error) {
		log(
			'detectTags: simple-wappalyzer failed; returning empty TagsMeta. Error: %O',
			error,
		);
		return cloneEmpty();
	}
	return assembleTagsMeta(detections, input.html);
}

/**
 * Builds a `TagsMeta` from the raw `simple-wappalyzer` output and the page
 * HTML used for ID extraction.
 *
 * Exported for unit tests that bypass `simple-wappalyzer` and feed
 * pre-recorded detections directly.
 * @param detections
 * @param html
 */
export function assembleTagsMeta(
	detections: readonly WappalyzerTech[],
	html: string,
): TagsMeta {
	const detected: Record<string, Record<string, TagDetail>> = {};
	const entries: TagEntry[] = [];

	for (const tech of detections) {
		if (!tech.name) continue;
		const ids = extractIds(tech.name, html);
		const categories =
			tech.categories
				?.map((c) => c.name)
				.filter((name): name is string => typeof name === 'string') ?? [];
		const detail: TagDetail = {
			ids,
			...(tech.version === undefined ? {} : { version: tech.version }),
			...(tech.confidence === undefined ? {} : { confidence: tech.confidence }),
		};
		for (const category of categories.length > 0 ? categories : ['Other']) {
			if (detected[category] === undefined) {
				detected[category] = {};
			}
			detected[category][tech.name] = detail;
		}

		const baseSources = [{ type: 'html' as const }];
		if (ids.length === 0) {
			entries.push({
				provider: tech.name,
				categories,
				...(tech.version === undefined ? {} : { version: tech.version }),
				...(tech.confidence === undefined ? {} : { confidence: tech.confidence }),
				sources: baseSources,
			});
		} else {
			for (const id of ids) {
				entries.push({
					provider: tech.name,
					categories,
					id,
					...(tech.version === undefined ? {} : { version: tech.version }),
					...(tech.confidence === undefined ? {} : { confidence: tech.confidence }),
					sources: baseSources,
				});
			}
		}
	}

	return { detected, entries };
}

/**
 *
 */
function cloneEmpty(): TagsMeta {
	return { detected: {}, entries: [] };
}

/**
 *
 * @param headers
 */
function normalizeHeaders(headers: DetectTagsInput['headers']): Record<string, string> {
	if (!headers) return {};
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue;
		const flat = Array.isArray(value) ? value.join(', ') : value;
		out[key.toLowerCase()] = flat;
	}
	return out;
}

/** Singleton empty `TagsMeta` value (exported for tests). */
export const EMPTY_TAGS_META = EMPTY_TAGS;
