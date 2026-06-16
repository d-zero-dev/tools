/**
 * Pure-function classifier that turns `RawHeadEntry[]` (collected on the browser
 * side by `collectHead`) into a typed `Meta` object.
 *
 * The classifier is the **only place** where dot-paths from `keys.ts` get
 * resolved against the `Meta` shape. Parsers (viewport/robots/refresh/etc.)
 * are dispatched on the fly for the few entries that need value normalization.
 *
 * Unknown entries (names/properties/rels not in the lookup tables) are
 * preserved in {@link Meta.others} so consumers never lose information.
 * @module
 */

import type { KeyDef, LinkRelDef } from './keys.js';
import type {
	JsonLdEntry,
	LinkEntry,
	Meta,
	OthersBucket,
	RawHeadEntry,
	TagsMeta,
} from './types.js';

import {
	HTTP_EQUIV_MAP,
	ITEMPROP_MAP,
	LINK_REL_MAP,
	META_NAME_MAP,
	META_PROPERTY_MAP,
} from './keys.js';
import {
	JSON_LD_TOTAL_LIMIT,
	capJsonLdContent,
	normalizeValue,
	parseFormatDetection,
	parseJsonLd,
	parseRefresh,
	parseReferrer,
	parseRobots,
	parseViewport,
} from './parsers.js';

const THEME_COLOR_DARK_MEDIA = /prefers-color-scheme:\s*dark/i;
const THEME_COLOR_LIGHT_MEDIA = /prefers-color-scheme:\s*light/i;

/**
 * Options for {@link classify}.
 */
export type ClassifyOptions = {
	/**
	 * When `true`, copies the input `raw` entries onto `Meta._raw` for debugging.
	 * Default `false` to keep the serialized `Meta` small.
	 */
	readonly includeRaw?: boolean;
	/**
	 * Pre-computed `TagsMeta` from `tag-detection.ts`. When omitted, an empty
	 * `TagsMeta` (with `detected: {}` and `entries: []`) is used.
	 */
	readonly tags?: TagsMeta;
};

/**
 * Builds the empty `Meta` skeleton with all required fields initialized.
 */
/** Returns a fresh `Meta` skeleton with all required fields initialized. */
export function emptyMeta(): Meta {
	return {
		title: '',
		originTrial: [],
		jsonLd: [],
		speculationRules: [],
		tags: { detected: {}, entries: [] },
		others: emptyOthersBucket(),
	};
}

/**
 *
 * @param meta
 */
function ensureHttpEquiv(meta: Meta): NonNullable<Meta['httpEquiv']> {
	if (meta.httpEquiv === undefined) {
		meta.httpEquiv = { originTrialToken: [] };
	} else if (!Array.isArray(meta.httpEquiv.originTrialToken)) {
		meta.httpEquiv.originTrialToken = [];
	}
	return meta.httpEquiv;
}

/**
 *
 */
function emptyOthersBucket(): OthersBucket {
	return {
		meta: {},
		property: {},
		httpEquiv: {},
		itemprop: {},
		link: [],
		script: [],
		iframe: [],
	};
}

/**
 * Writes `value` to `target` along `dotPath`. Intermediate objects are created
 * on demand. When `multi` is `true`, the leaf is treated as an array and `value`
 * is appended; otherwise the first assignment wins (subsequent calls are no-ops).
 *
 * Exported for the unit tests in `classify.spec.ts`.
 * @param target
 * @param dotPath
 * @param value
 * @param multi
 */
export function setByPath(
	target: Record<string, unknown>,
	dotPath: string,
	value: unknown,
	multi: boolean,
): void {
	const segments = dotPath.split('.');
	if (segments.length === 0) return;
	let cursor: Record<string, unknown> = target;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i] ?? '';
		if (!seg) return;
		const next = cursor[seg];
		if (next == null || typeof next !== 'object' || Array.isArray(next)) {
			const created: Record<string, unknown> = {};
			cursor[seg] = created;
			cursor = created;
		} else {
			cursor = next as Record<string, unknown>;
		}
	}
	const leaf = segments.at(-1) ?? '';
	if (!leaf) return;
	if (multi) {
		const existing = cursor[leaf];
		if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			cursor[leaf] = [value];
		}
	} else if (cursor[leaf] === undefined) {
		cursor[leaf] = value;
	}
}

/**
 *
 * @param meta
 * @param def
 * @param rawValue
 */
function applyKeyDef(meta: Meta, def: KeyDef, rawValue: string): void {
	const value = normalizeValue(rawValue, def.transform);
	for (const path of def.paths) {
		setByPath(
			meta as unknown as Record<string, unknown>,
			path,
			value,
			def.multi === true,
		);
	}
}

/**
 *
 * @param meta
 * @param name
 * @param content
 * @param media
 */
function classifyMetaName(
	meta: Meta,
	name: string,
	content: string,
	media: string | undefined,
): boolean {
	if (name === 'viewport') {
		if (meta.viewport === undefined) {
			meta.viewport = parseViewport(content);
		}
		return true;
	}
	if (name === 'robots') {
		if (meta.robots === undefined) {
			meta.robots = parseRobots(content);
		}
		return true;
	}
	if (name === 'referrer') {
		if (meta.referrer === undefined) {
			meta.referrer = parseReferrer(content);
		}
		return true;
	}
	if (name === 'format-detection') {
		const parsed = parseFormatDetection(content);
		if (meta.formatDetection === undefined) {
			meta.formatDetection = parsed;
		}
		if (parsed.telephone === false && meta.apple === undefined) {
			meta.apple = { formatDetectionTelephone: false };
		} else if (parsed.telephone === false && meta.apple !== undefined) {
			meta.apple.formatDetectionTelephone = false;
		}
		return true;
	}
	if (name === 'theme-color') {
		const target =
			media && THEME_COLOR_DARK_MEDIA.test(media)
				? 'themeColorDark'
				: media && THEME_COLOR_LIGHT_MEDIA.test(media)
					? 'themeColorLight'
					: 'themeColor';
		if ((meta as Record<string, unknown>)[target] === undefined) {
			(meta as Record<string, unknown>)[target] = content;
		}
		return true;
	}
	if (name === 'google') {
		const flag = content.trim().toLowerCase();
		if (
			flag === 'notranslate' ||
			flag === 'nositelinkssearchbox' ||
			flag === 'nopagereadaloud'
		) {
			const camel = flag.replaceAll(/-([a-z])/g, (_match, ch: string) =>
				ch.toUpperCase(),
			);
			if (meta.google === undefined) {
				meta.google = {};
			}
			(meta.google as Record<string, unknown>)[camel] = true;
			return true;
		}
	}
	if (name === 'googlebot' && content.trim().toLowerCase() === 'notranslate') {
		if (meta.google === undefined) {
			meta.google = {};
		}
		meta.google.googlebotNotranslate = true;
		// fall through to also write `googlebot` field
	}

	const def = META_NAME_MAP[name];
	if (def) {
		applyKeyDef(meta, def, content);
		return true;
	}
	return false;
}

/**
 *
 * @param meta
 * @param property
 * @param content
 */
function classifyMetaProperty(meta: Meta, property: string, content: string): boolean {
	const def = META_PROPERTY_MAP[property];
	if (def) {
		applyKeyDef(meta, def, content);
		return true;
	}
	return false;
}

/**
 *
 * @param meta
 * @param key
 * @param content
 */
function classifyHttpEquiv(meta: Meta, key: string, content: string): boolean {
	if (key === 'refresh') {
		const slot = ensureHttpEquiv(meta);
		if (slot.refresh === undefined) {
			slot.refresh = parseRefresh(content);
		}
		return true;
	}
	const def = HTTP_EQUIV_MAP[key];
	if (def) {
		applyKeyDef(meta, def, content);
		return true;
	}
	return false;
}

/**
 *
 * @param meta
 * @param key
 * @param content
 */
function classifyItemprop(meta: Meta, key: string, content: string): boolean {
	const def = ITEMPROP_MAP[key];
	if (def) {
		applyKeyDef(meta, def, content);
		return true;
	}
	return false;
}

/**
 *
 * @param entry
 */
function makeLinkEntry(entry: Extract<RawHeadEntry, { kind: 'link' }>): LinkEntry {
	return {
		href: entry.href,
		rel: entry.rel,
		type: entry.type,
		media: entry.media,
		sizes: entry.sizes,
		title: entry.title,
		hreflang: entry.hreflang,
		as: entry.as,
		crossorigin: entry.crossorigin,
		color: entry.color,
		blocking: entry.blocking,
		imagesrcset: entry.imagesrcset,
	};
}

/**
 *
 * @param meta
 * @param def
 * @param entry
 */
function applyLinkRel(meta: Meta, def: LinkRelDef, entry: LinkEntry): void {
	if (meta.link === undefined) {
		meta.link = createEmptyLinkMeta();
	}
	const linkRecord = meta.link as unknown as Record<string, unknown>;
	switch (def.cardinality) {
		case 'href-only': {
			if (linkRecord[def.path] === undefined) {
				linkRecord[def.path] = entry.href;
			}
			break;
		}
		case 'single': {
			if (linkRecord[def.path] === undefined) {
				linkRecord[def.path] = entry;
			}
			break;
		}
		case 'array': {
			const list = linkRecord[def.path];
			if (Array.isArray(list)) {
				list.push(entry);
			} else {
				linkRecord[def.path] = [entry];
			}
			break;
		}
		case 'icon-sized': {
			if (entry.sizes) {
				const list = linkRecord[def.path];
				if (Array.isArray(list)) {
					list.push(entry);
				} else {
					linkRecord[def.path] = [entry];
				}
			}
			break;
		}
	}
}

/**
 *
 */
function createEmptyLinkMeta(): NonNullable<Meta['link']> {
	return {
		alternateHreflang: [],
		alternateMedia: [],
		alternateRss: [],
		alternateAtom: [],
		alternateJsonFeed: [],
		tag: [],
		archives: [],
		appendix: [],
		chapter: [],
		section: [],
		subsection: [],
		profile: [],
		me: [],
		enclosure: [],
		external: [],
		nofollow: [],
		sponsored: [],
		ugc: [],
		noopener: [],
		noreferrer: [],
		opener: [],
		dnsPrefetch: [],
		preconnect: [],
		prefetch: [],
		prerender: [],
		preload: [],
		modulepreload: [],
		expect: [],
		stylesheet: [],
		syndication: [],
		related: [],
		iconSized: [],
		appleTouchIconSized: [],
		appleTouchIconPrecomposed: [],
		appleTouchStartupImage: [],
	};
}

/**
 * Refines `alternate` rel into RSS/Atom/JSON-Feed sub-buckets when `type` matches.
 * @param meta
 * @param entry
 */
function refineAlternate(meta: Meta, entry: LinkEntry): void {
	if (meta.link === undefined) {
		meta.link = createEmptyLinkMeta();
	}
	const t = entry.type?.toLowerCase();
	switch (t) {
		case 'application/rss+xml': {
			meta.link.alternateRss.push(entry);

			break;
		}
		case 'application/atom+xml': {
			meta.link.alternateAtom.push(entry);

			break;
		}
		case 'application/feed+json': {
			meta.link.alternateJsonFeed.push(entry);

			break;
		}
		case 'application/json+oembed': {
			if (meta.link.oembedJson === undefined) {
				meta.link.oembedJson = entry;
			}

			break;
		}
		case 'application/xml+oembed': {
			if (meta.link.oembedXml === undefined) {
				meta.link.oembedXml = entry;
			}

			break;
		}
		case 'application/activity+json': {
			if (meta.link.alternateActivityJson === undefined) {
				meta.link.alternateActivityJson = entry;
			}

			break;
		}
		default: {
			if (entry.media) {
				meta.link.alternateMedia.push(entry);
			} else {
				meta.link.alternateHreflang.push(entry);
			}
		}
	}
}

/**
 * Refines `icon` rel by `type`/`sizes`/`media`.
 * @param meta
 * @param entry
 */
function refineIcon(meta: Meta, entry: LinkEntry): void {
	if (meta.link === undefined) {
		meta.link = createEmptyLinkMeta();
	}
	const sizes = entry.sizes?.toLowerCase();
	if (entry.type === 'image/svg+xml') {
		if (meta.link.iconSvg === undefined) {
			meta.link.iconSvg = entry;
		}
		return;
	}
	if (sizes === 'any') {
		if (meta.link.iconAny === undefined) {
			meta.link.iconAny = entry;
		}
		return;
	}
	if (entry.sizes) {
		meta.link.iconSized.push(entry);
		return;
	}
	if (meta.link.icon === undefined) {
		meta.link.icon = entry;
	}
}

/**
 *
 * @param meta
 * @param entry
 */
function refineAppleTouchIcon(meta: Meta, entry: LinkEntry): void {
	if (meta.link === undefined) {
		meta.link = createEmptyLinkMeta();
	}
	if (entry.sizes) {
		meta.link.appleTouchIconSized.push(entry);
		return;
	}
	if (meta.link.appleTouchIcon === undefined) {
		meta.link.appleTouchIcon = entry;
	}
}

/**
 *
 * @param meta
 * @param entry
 */
function refineAppleTouchStartupImage(meta: Meta, entry: LinkEntry): void {
	if (meta.link === undefined) {
		meta.link = createEmptyLinkMeta();
	}
	meta.link.appleTouchStartupImage.push(entry);
	const media = entry.media ?? '';
	if (/device-width:\s*320px/i.test(media)) {
		if (meta.link.appleTouchStartupImageIphone === undefined) {
			meta.link.appleTouchStartupImageIphone = entry;
		}
	} else if (/device-width:\s*768px/i.test(media) && /portrait/i.test(media)) {
		if (meta.link.appleTouchStartupImageIpadPortrait === undefined) {
			meta.link.appleTouchStartupImageIpadPortrait = entry;
		}
	} else if (
		/device-width:\s*768px/i.test(media) &&
		/landscape/i.test(media) &&
		meta.link.appleTouchStartupImageIpadLandscape === undefined
	) {
		meta.link.appleTouchStartupImageIpadLandscape = entry;
	}
}

/**
 *
 * @param meta
 * @param entry
 */
function classifyLink(meta: Meta, entry: Extract<RawHeadEntry, { kind: 'link' }>): void {
	const linkEntry = makeLinkEntry(entry);
	let anyKnown = false;
	for (const rel of entry.rel) {
		const lower = rel.toLowerCase();
		if (lower === 'alternate') {
			refineAlternate(meta, linkEntry);
			anyKnown = true;
			continue;
		}
		if (lower === 'icon') {
			refineIcon(meta, linkEntry);
			anyKnown = true;
			continue;
		}
		if (lower === 'apple-touch-icon') {
			refineAppleTouchIcon(meta, linkEntry);
			anyKnown = true;
			continue;
		}
		if (lower === 'apple-touch-startup-image') {
			refineAppleTouchStartupImage(meta, linkEntry);
			anyKnown = true;
			continue;
		}
		if (lower === 'me' && meta.microformats === undefined) {
			meta.microformats = { relMe: [linkEntry.href] };
			anyKnown = true;
		} else if (lower === 'me' && meta.microformats !== undefined) {
			meta.microformats.relMe.push(linkEntry.href);
			anyKnown = true;
		}
		const def = LINK_REL_MAP[lower];
		if (def) {
			applyLinkRel(meta, def, linkEntry);
			anyKnown = true;
		}
	}
	if (!anyKnown) {
		meta.others.link.push(linkEntry);
	}
}

/**
 *
 * @param meta
 * @param entry
 * @param totals
 * @param totals.jsonLdBytes
 */
function classifyScript(
	meta: Meta,
	entry: Extract<RawHeadEntry, { kind: 'script' }>,
	totals: { jsonLdBytes: number },
): void {
	const type = entry.scriptType.toLowerCase();
	if (type === 'application/ld+json' || type === 'speculationrules') {
		const raw = entry.content ?? '';
		if (totals.jsonLdBytes + raw.length > JSON_LD_TOTAL_LIMIT) {
			const remaining = Math.max(0, JSON_LD_TOTAL_LIMIT - totals.jsonLdBytes);
			const capped = raw.slice(0, remaining);
			totals.jsonLdBytes += capped.length;
			const jsonEntry: JsonLdEntry = {
				raw: capped,
				parseError: 'truncated: total jsonLd bytes exceeded limit',
			};
			pushJsonLd(meta, type, jsonEntry);
			return;
		}
		const { content: capped, truncated } = capJsonLdContent(raw);
		totals.jsonLdBytes += capped.length;
		const jsonEntry = parseJsonLd(capped);
		if (truncated && jsonEntry.parseError === undefined) {
			jsonEntry.parseError = 'truncated: per-entry size limit exceeded';
		}
		pushJsonLd(meta, type, jsonEntry);
		return;
	}
	meta.others.script.push({
		type: entry.scriptType,
		content: entry.content,
		src: entry.src,
		location: entry.location,
	});
}

/**
 *
 * @param meta
 * @param type
 * @param entry
 */
function pushJsonLd(meta: Meta, type: string, entry: JsonLdEntry): void {
	if (type === 'application/ld+json') {
		meta.jsonLd.push(entry);
	} else if (type === 'speculationrules') {
		meta.speculationRules.push(entry);
	}
}

/**
 * Top-level classifier. Takes a list of raw entries collected from the page
 * and produces a populated `Meta`.
 * @param raw
 * @param options
 */
export function classify(
	raw: readonly RawHeadEntry[],
	options: ClassifyOptions = {},
): Meta {
	const meta = emptyMeta();
	const totals = { jsonLdBytes: 0 };
	if (options.tags) {
		meta.tags = options.tags;
	}
	for (const entry of raw) {
		classifyEntry(meta, entry, totals);
	}
	if (options.includeRaw) {
		meta._raw = raw;
	}
	return meta;
}

/**
 *
 * @param meta
 * @param entry
 * @param totals
 * @param totals.jsonLdBytes
 */
function classifyEntry(
	meta: Meta,
	entry: RawHeadEntry,
	totals: { jsonLdBytes: number },
): void {
	switch (entry.kind) {
		case 'html': {
			if (entry.lang) meta.lang = entry.lang;
			if (entry.dir) meta.dir = entry.dir;
			if (entry.xmlns) meta.xmlns = entry.xmlns;
			if (entry.prefix) {
				meta.prefix = entry.prefix;
				if (meta.rdfa === undefined) meta.rdfa = {};
				meta.rdfa.prefix = entry.prefix;
			}
			if (entry.vocab) {
				meta.vocab = entry.vocab;
				if (meta.rdfa === undefined) meta.rdfa = {};
				meta.rdfa.vocab = entry.vocab;
			}
			if (entry.typeOf) {
				meta.typeOf = entry.typeOf;
				if (meta.rdfa === undefined) meta.rdfa = {};
				meta.rdfa.typeOf = entry.typeOf;
			}
			if (entry.itemtype) {
				meta.itemType = entry.itemtype;
				if (meta.microdata === undefined) meta.microdata = {};
				meta.microdata.itemtype = entry.itemtype;
			}
			if (entry.itemscope) {
				if (meta.microdata === undefined) meta.microdata = {};
				meta.microdata.itemscope = true;
			}
			if (entry.amp || entry.lightning) {
				if (meta.amp === undefined) meta.amp = {};
				if (entry.amp) meta.amp.enabled = true;
				if (entry.lightning) meta.amp.lightning = true;
			}
			break;
		}
		case 'title': {
			if (meta.title === '') {
				meta.title = entry.content;
			}
			break;
		}
		case 'base': {
			if (entry.href && meta.baseHref === undefined) {
				meta.baseHref = entry.href;
			}
			if (entry.target && meta.baseTarget === undefined) {
				meta.baseTarget = entry.target;
			}
			break;
		}
		case 'meta': {
			if (entry.charset && meta.charset === undefined) {
				meta.charset = entry.charset;
			}
			const content = entry.content ?? '';
			if (entry.name) {
				const handled = classifyMetaName(meta, entry.name, content, entry.media);
				if (!handled) {
					pushMulti(meta.others.meta, entry.name, content);
				}
			}
			if (entry.property) {
				const handled = classifyMetaProperty(meta, entry.property, content);
				if (!handled) {
					pushMulti(meta.others.property, entry.property, content);
				}
			}
			if (entry.httpEquiv) {
				const handled = classifyHttpEquiv(meta, entry.httpEquiv, content);
				if (!handled) {
					pushMulti(meta.others.httpEquiv, entry.httpEquiv, content);
				}
			}
			if (entry.itemprop) {
				const handled = classifyItemprop(meta, entry.itemprop, content);
				if (!handled) {
					pushMulti(meta.others.itemprop, entry.itemprop, content);
				}
			}
			break;
		}
		case 'link': {
			classifyLink(meta, entry);
			break;
		}
		case 'script': {
			classifyScript(meta, entry, totals);
			break;
		}
		case 'iframe': {
			meta.others.iframe.push({ src: entry.src, location: entry.location });
			break;
		}
		case 'window-global': {
			// `window-global` entries are consumed by the tag-detection layer,
			// not by classify itself. Ignored here.
			break;
		}
	}
}

/**
 *
 * @param bucket
 * @param key
 * @param value
 */
function pushMulti(bucket: Record<string, string[]>, key: string, value: string): void {
	const list = bucket[key];
	if (list) {
		list.push(value);
	} else {
		bucket[key] = [value];
	}
}
