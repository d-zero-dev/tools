/**
 * DOM-side raw `<head>` collector.
 *
 * `collectHeadFromDocument` walks a `Document` (Puppeteer page realm or jsdom realm
 * alike) and produces a serializable {@link RawHeadEntry}[] that
 * {@link ../meta/classify.ts | classify} can turn into a typed `Meta`.
 *
 * WHY this function is realm-agnostic:
 *
 * - The Puppeteer path stringifies this function via `Function.prototype.toString`
 *   and runs it as a `page.evaluate(string)` expression, so any closure over
 *   module-scope bindings would resolve to `undefined` in the browser realm.
 * - The jsdom (Node) path calls it directly with the jsdom `Window`. Because
 *   `HTMLLinkElement` (etc.) in jsdom is a *different class instance* from the
 *   one in the page realm, `instanceof` only works when the constructor is read
 *   from the *passed* `window` rather than from bare globals.
 *
 * Together those constraints dictate that the function MUST:
 *
 * 1. Reference no module-level variables — only its own parameters and inner locals.
 * 2. Take every HTML class constructor (`HTMLBaseElement`, …) from the passed
 *    `window` via destructuring instead of relying on ambient globals.
 * 3. Stay in plain ES syntax (no TS-only constructs that need helper imports).
 * @module
 */

import type { RawHeadEntry } from './types.js';

/**
 * Curated list of `window` globals whose presence indicates that a third-party
 * tag library has been loaded on the page. Surfaced as a single
 * `kind: 'window-global'` entry so that downstream consumers (e.g. tag-detection)
 * can cross-reference the script/iframe signals.
 *
 * Kept here (rather than in `dom-evaluation.ts`) so the Puppeteer path and the
 * jsdom path share one source of truth.
 */
export const WINDOW_GLOBALS_TO_CHECK: readonly string[] = [
	'dataLayer',
	'gtag',
	'ga',
	'_gaq',
	'fbq',
	'_fbq',
	'clarity',
	'_hjSettings',
	'_hjid',
	'twq',
	'ttq',
	'_linkedin_partner_id',
	'pintrk',
	'amplitude',
	'mixpanel',
	'analytics',
	'heap',
	'posthog',
	'plausible',
	'fathom',
	'_paq',
	's_account',
	's',
	'ym',
	'UET',
	'optimizely',
	'_hsq',
	'Sentry',
	'Intercom',
	'intercomSettings',
	'drift',
	'Tawk_API',
	'zE',
	'OneTrust',
	'Cookiebot',
	'Stripe',
	'grecaptcha',
];

/**
 * Walks the given window's `Document` and returns a serializable list of raw
 * head entries.
 *
 * Two realms are supported:
 *
 * - Browser realm (Puppeteer): the function source is `.toString()`'d and run
 *   inside the page via `page.evaluate(string)`. Inside the page, `window`
 *   resolves to the page's global object, so destructured class constructors
 *   match `instanceof` checks against elements returned from `querySelectorAll`.
 * - Node realm (jsdom et al.): the caller passes `dom.window` directly. jsdom's
 *   HTML element prototypes are distinct from the host Node's bare globals, so
 *   reading the constructors off the passed `window` is what makes `instanceof`
 *   succeed.
 *
 * The function MUST NOT close over any module-scope binding — all data it needs
 * is reached through its two parameters.
 * @param window - The window object whose `document` will be inspected. Provides
 *                 both the DOM tree and the HTML element constructors used for
 *                 `instanceof` narrowing.
 * @param knownGlobals - Names of `window` properties that, when present,
 *                       indicate a third-party tag library is loaded. Required
 *                       (no default) so the Puppeteer-side string-eval path
 *                       does not have to inline a default value list.
 * @returns Serializable list of raw head entries for {@link ../meta/classify.ts | classify}.
 */
export function collectHeadFromDocument(
	window: Window,
	knownGlobals: readonly string[],
): RawHeadEntry[] {
	const document = window.document;
	// TypeScript's `Window` interface in lib.dom does not directly expose the
	// HTML element constructors (`HTMLLinkElement`, `HTMLScriptElement`, …)
	// even though every real window object — browser realm AND jsdom realm —
	// carries them at runtime. Widening the type here lets us destructure them
	// uniformly; the runtime values come straight from the passed window, so
	// the cast is purely cosmetic for TS and erased at compile time.
	const w = window as Window & {
		HTMLBaseElement: typeof globalThis.HTMLBaseElement;
		HTMLMetaElement: typeof globalThis.HTMLMetaElement;
		HTMLLinkElement: typeof globalThis.HTMLLinkElement;
		HTMLScriptElement: typeof globalThis.HTMLScriptElement;
		HTMLIFrameElement: typeof globalThis.HTMLIFrameElement;
	};
	const {
		HTMLBaseElement,
		HTMLMetaElement,
		HTMLLinkElement,
		HTMLScriptElement,
		HTMLIFrameElement,
	} = w;

	const entries: RawHeadEntry[] = [];

	const html = document.documentElement;
	entries.push(
		{
			kind: 'html',
			lang: html.lang || undefined,
			dir: html.dir || undefined,
			xmlns: html.getAttribute('xmlns') ?? undefined,
			prefix: html.getAttribute('prefix') ?? undefined,
			vocab: html.getAttribute('vocab') ?? undefined,
			typeOf: html.getAttribute('typeof') ?? undefined,
			itemscope: html.hasAttribute('itemscope') || undefined,
			itemtype: html.getAttribute('itemtype') ?? undefined,
			amp: html.hasAttribute('amp') || undefined,
			lightning: html.hasAttribute('⚡') || undefined,
		},
		{ kind: 'title', content: document.title },
	);

	for (const base of document.querySelectorAll('base')) {
		if (!(base instanceof HTMLBaseElement)) continue;
		entries.push({
			kind: 'base',
			href: base.getAttribute('href') ?? undefined,
			target: base.getAttribute('target') ?? undefined,
		});
	}

	for (const meta of document.querySelectorAll('meta')) {
		if (!(meta instanceof HTMLMetaElement)) continue;
		const name = meta.getAttribute('name');
		const property = meta.getAttribute('property');
		const httpEquiv = meta.getAttribute('http-equiv');
		const itemprop = meta.getAttribute('itemprop');
		const charset = meta.getAttribute('charset');
		const content = meta.getAttribute('content');
		const media = meta.getAttribute('media');
		entries.push({
			kind: 'meta',
			name: name ? name.toLowerCase() : undefined,
			property: property ? property.toLowerCase() : undefined,
			httpEquiv: httpEquiv ? httpEquiv.toLowerCase() : undefined,
			itemprop: itemprop ?? undefined,
			charset: charset ?? undefined,
			content: content ?? undefined,
			media: media ?? undefined,
		});
	}

	for (const link of document.querySelectorAll('link[href]')) {
		if (!(link instanceof HTMLLinkElement)) continue;
		const relRaw = link.getAttribute('rel') ?? '';
		const rel = relRaw.toLowerCase().split(/\s+/u).filter(Boolean);
		entries.push({
			kind: 'link',
			rel,
			href: link.getAttribute('href') ?? '',
			type: link.getAttribute('type') ?? undefined,
			media: link.getAttribute('media') ?? undefined,
			sizes: link.getAttribute('sizes') ?? undefined,
			title: link.getAttribute('title') ?? undefined,
			hreflang: link.getAttribute('hreflang') ?? undefined,
			as: link.getAttribute('as') ?? undefined,
			crossorigin: link.getAttribute('crossorigin') ?? undefined,
			color: link.getAttribute('color') ?? undefined,
			blocking: link.getAttribute('blocking') ?? undefined,
			imagesrcset: link.getAttribute('imagesrcset') ?? undefined,
		});
	}

	const STRUCTURED_TYPES = new Set([
		'application/ld+json',
		'speculationrules',
		'application/json+oembed',
		'application/xml+oembed',
	]);
	for (const script of document.querySelectorAll('script[type]')) {
		if (!(script instanceof HTMLScriptElement)) continue;
		const scriptType = (script.getAttribute('type') ?? '').toLowerCase();
		if (!STRUCTURED_TYPES.has(scriptType)) continue;
		const src = script.getAttribute('src') ?? undefined;
		const text = script.textContent ?? '';
		const inHead = !!script.closest('head');
		const inNoscript = !!script.closest('noscript');
		const location = inHead ? 'head' : inNoscript ? 'noscript' : 'body';
		entries.push({
			kind: 'script',
			scriptType,
			content: text || undefined,
			src,
			location,
		});
	}

	for (const iframe of document.querySelectorAll('iframe[src]')) {
		if (!(iframe instanceof HTMLIFrameElement)) continue;
		const src = iframe.getAttribute('src') ?? '';
		if (!src) continue;
		const inHead = !!iframe.closest('head');
		const inNoscript = !!iframe.closest('noscript');
		const location = inHead ? 'head' : inNoscript ? 'noscript' : 'body';
		entries.push({ kind: 'iframe', src, location });
	}

	const win = window as unknown as Record<string, unknown>;
	const presentGlobals: string[] = [];
	for (const name of knownGlobals) {
		if (win[name] !== undefined) {
			presentGlobals.push(name);
		}
	}
	if (presentGlobals.length > 0) {
		entries.push({ kind: 'window-global', names: presentGlobals });
	}

	return entries;
}
