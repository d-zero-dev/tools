/**
 * DOM evaluation functions for extracting structured data from Puppeteer pages.
 *
 * These functions are called by {@link ./scraper.ts | Scraper.#fetchData} to extract
 * anchors, images, and meta information after page navigation completes.
 *
 * WHY timeouts everywhere: A page whose main thread is blocked (heavy JS, autoplay
 * video players, infinite loops) makes every CDP round-trip hang. `getMeta` and
 * `getImageList` therefore collect all data in a single `page.evaluate` and wrap it
 * in {@link raceWithTimeout} so a blocked thread is abandoned after a bounded budget
 * instead of accumulating per-property timeouts up to the caller's global timeout.
 * Note that `page.evaluate` itself runs on the page's main thread and has no built-in
 * timeout, so the surrounding race is what actually bounds the hang.
 * @see {@link ./types.ts} for the data types returned by these functions
 */

import type { AnchorData, ImageElement, Meta, ParseURLOptions } from './types.js';
import type { CDPSession, ElementHandle, Page } from 'puppeteer';

import { raceWithTimeout } from '@d-zero/shared/race-with-timeout';

import { domDetailsLog, domLog } from './debug.js';
import { parseUrl } from './parse-url.js';

const pid = `${process.pid}`;
const log = domLog.extend(pid);
const dLog = domDetailsLog.extend(pid);

/**
 * Default timeout (ms) applied to DOM evaluation operations when the caller does not
 * specify one. Bounds how long a single `page.evaluate` / property read may hang on a
 * page whose main thread is unresponsive.
 *
 * WHY 180s: Aligned with the upstream `Scraper#fetchData` retryable timeout (3 min) so
 * a single phase does not exceed the retry budget while still tolerating large pages
 * (e.g., 1000+ anchors) and slow main threads.
 */
export const DEFAULT_DOM_EVALUATION_TIMEOUT = 180_000;

/**
 * Parameters for {@link getProp}.
 * @template T - The expected type of the property value.
 */
export interface GetPropParams<T> {
	/** The Puppeteer element handle to read the property from. */
	readonly $el: ElementHandle<Element>;
	/** The name of the DOM property to retrieve (e.g., `"href"`, `"textContent"`). */
	readonly propName: string;
	/** The default value to return if the property cannot be read or times out. */
	readonly fallback: T;
}

/**
 * Retrieves a DOM property value from a Puppeteer element handle with a timeout.
 *
 * Races the actual property retrieval against a timeout via {@link raceWithTimeout},
 * which clears the loser-side timer so it cannot keep the event loop alive.
 * If the property cannot be read or the timeout expires, the fallback value is returned.
 * @template T - The expected type of the property value.
 * @param params - Parameters containing the element, property name, and fallback.
 * @param timeout - Timeout in ms before falling back. Defaults to {@link DEFAULT_DOM_EVALUATION_TIMEOUT}.
 * @returns The property value, or the fallback if retrieval fails or times out.
 */
export async function getProp<T>(
	params: GetPropParams<T>,
	timeout: number = DEFAULT_DOM_EVALUATION_TIMEOUT,
): Promise<T> {
	const { $el, propName, fallback } = params;
	const { result, timeout: timedOut } = await raceWithTimeout(
		() => _getProp($el, propName, fallback),
		timeout,
	);
	return timedOut ? fallback : result;
}

/**
 * Internal implementation of property retrieval without timeout.
 * @template T - The expected type of the property value.
 * @param $el - The Puppeteer element handle.
 * @param propName - The DOM property name.
 * @param fallback - The default value on failure.
 * @returns The property value cast to `T`, or the fallback.
 */
async function _getProp<T>(
	$el: ElementHandle<Element>,
	propName: string,
	fallback: T,
): Promise<T> {
	try {
		const prop = await $el.getProperty(propName);
		if (!prop) {
			return fallback;
		}
		const value = (await prop.jsonValue()) as T;
		return value;
	} catch {
		return fallback;
	}
}

/**
 * Extracts all `<img>` elements from the page and returns their properties.
 *
 * Collects every image's `src`, `currentSrc`, `alt`, layout dimensions,
 * natural dimensions, lazy-loading status, and outer HTML in a single
 * `page.evaluate` call, wrapped in {@link raceWithTimeout}. On timeout (an
 * unresponsive page) an empty array is returned rather than hanging.
 * @param page - The Puppeteer page to extract images from.
 * @param viewportWidth - The current viewport width in pixels, recorded alongside each image entry.
 * @param timeout - Timeout in ms for the evaluation. Defaults to {@link DEFAULT_DOM_EVALUATION_TIMEOUT}.
 * @returns An array of {@link ImageElement} objects describing each image on the page.
 */
export async function getImageList(
	page: Page,
	viewportWidth: number,
	timeout: number = DEFAULT_DOM_EVALUATION_TIMEOUT,
): Promise<ImageElement[]> {
	log('Getting images (Viewport: %dpx)', viewportWidth);

	const { result, timeout: timedOut } = await raceWithTimeout(
		() =>
			page
				.evaluate(() => {
					/* global document */
					return [...document.images].map((img) => {
						const rect = img.getBoundingClientRect();
						return {
							src: img.src,
							currentSrc: img.currentSrc,
							alt: img.alt,
							width: rect.width,
							height: rect.height,
							naturalWidth: img.naturalWidth,
							naturalHeight: img.naturalHeight,
							loading: img.loading,
							sourceCode: img.outerHTML,
						};
					});
				})
				.catch(() => null),
		timeout,
	);

	if (timedOut || result == null) {
		log(
			'Image extraction timed out or failed (Viewport: %dpx); returning []',
			viewportWidth,
		);
		return [];
	}

	const imageList: ImageElement[] = result.map(({ loading, ...img }) => ({
		...img,
		isLazy: loading.toLowerCase().trim() === 'lazy',
		viewportWidth,
	}));

	log('Got %d images (Viewport: %dpx)', imageList.length, viewportWidth);
	dLog(
		'Images are: %O',
		imageList.map((i) => i.src),
	);
	return imageList;
}

/**
 * Page-like shape exposing puppeteer's internal CDP session.
 *
 * WHY private `_client()` instead of `page.createCDPSession()`: the `objectId`
 * returned by {@link ElementHandle.remoteObject} is scoped to the page's primary
 * session. A fresh session created via `createCDPSession()` cannot resolve those
 * `objectId` values when calling `DOM.describeNode`, so we must reuse the same
 * session puppeteer uses internally.
 */
interface PageWithInternalClient {
	_client(): CDPSession;
}

/** Minimal shape of a CDP `Accessibility.AXValue` we read from. */
interface AXValueLike {
	readonly value?: unknown;
}

/** Minimal shape of a CDP `Accessibility.AXNode` we read from. */
interface AXNodeLike {
	readonly backendDOMNodeId?: number;
	readonly ignored?: boolean;
	readonly name?: AXValueLike;
}

interface GetFullAXTreeResponse {
	readonly nodes: readonly AXNodeLike[];
}

interface DescribeNodeResponse {
	readonly node: { readonly backendNodeId?: number };
}

/**
 * Returns puppeteer's internal CDP session for the page, or `null` if it is
 * unreachable (e.g., test mocks, puppeteer wrappers that hide the internal API).
 *
 * Callers fall back to a textContent-only path when this returns `null`.
 * @param page - The Puppeteer page.
 */
function getInternalCDPClient(page: Page): CDPSession | null {
	try {
		const client = (page as unknown as Partial<PageWithInternalClient>)._client?.();
		return client ?? null;
	} catch {
		return null;
	}
}

/**
 * Fetches the full accessibility tree once and builds a `backendDOMNodeId → accessibleName`
 * map covering every AX node that exposes a backend DOM id.
 *
 * WHY include every non-ignored node (not just `role === 'link'`): the original
 * `page.accessibility.snapshot({ root })` returned whatever AX node represented
 * the anchor — including anchors whose computed role was overridden via ARIA
 * (e.g., `<a role="button">`). Mapping every non-ignored node preserves that.
 *
 * WHY skip `ignored === true`: puppeteer's high-level snapshot uses
 * `interestingOnly: true` by default and returns `null` for ignored nodes
 * (aria-hidden, display:none, visibility:hidden). The old code then fell back
 * to `textContent.trim()`. Including ignored nodes here would short-circuit
 * that fallback with the AX tree's empty name and silently drop link text.
 *
 * On timeout or CDP failure, an empty map is returned so callers transparently
 * fall back to `textContent.trim()` for every anchor.
 * @param client - The CDP session attached to the page.
 * @param timeout - Maximum time to wait for the AX tree fetch.
 */
async function buildAccessibleNameMap(
	client: CDPSession,
	timeout: number,
): Promise<Map<number, string>> {
	const { result, timeout: timedOut } = await raceWithTimeout(
		() =>
			client
				.send('Accessibility.getFullAXTree')
				.then((res) => res as unknown as GetFullAXTreeResponse)
				.catch((error: unknown) => {
					log('Accessibility.getFullAXTree failed: %O', error);
					return null;
				}),
		timeout,
	);
	const map = new Map<number, string>();
	if (timedOut) {
		log('Accessibility.getFullAXTree timed out after %dms', timeout);
		return map;
	}
	if (!result?.nodes) {
		return map;
	}
	for (const node of result.nodes) {
		if (node.backendDOMNodeId == null || node.ignored === true) {
			continue;
		}
		const name = typeof node.name?.value === 'string' ? node.name.value : '';
		map.set(node.backendDOMNodeId, name);
	}
	return map;
}

/**
 * Resolves a CDP backend node id for a given element handle.
 *
 * Wrapped in {@link raceWithTimeout} so a single hung `DOM.describeNode` cannot
 * stall the outer `Promise.all` over every anchor on the page.
 * @param client - The CDP session attached to the page (must be the same session
 *                 that owns the handle's `objectId`).
 * @param objectId - The remote object id of the element handle.
 * @param timeout - Maximum time to wait for the describeNode call.
 * @returns The backend node id, or `null` if unavailable / timed out / failed.
 */
async function resolveBackendNodeId(
	client: CDPSession,
	objectId: string,
	timeout: number,
): Promise<number | null> {
	const { result, timeout: timedOut } = await raceWithTimeout(
		() =>
			client
				.send('DOM.describeNode', { objectId })
				.then((res) => res as unknown as DescribeNodeResponse)
				.catch(() => null),
		timeout,
	);
	if (timedOut || !result) {
		return null;
	}
	return result.node?.backendNodeId ?? null;
}

/**
 * Extracts all anchor (`<a>` and `<area>`) elements with `href` attributes from the page.
 *
 * For each anchor, resolves the `href` to an `ExURL` via `parseUrl`, retrieves
 * the accessible name (from the accessibility tree, falling back to `textContent`),
 * and filters out non-HTTP links.
 *
 * WHY Strategy F (single AX-tree fetch + parallel `DOM.describeNode`): the old
 * implementation called `page.accessibility.snapshot({ root })` per anchor, which
 * triggers a CDP round-trip *and* a Chrome-side AX subtree computation (~42ms
 * each). On a page with 1181 anchors that compounded to ~53s. By fetching the
 * full AX tree once and using `DOM.describeNode` in parallel to map element
 * handles back to AX nodes by `backendDOMNodeId`, the same data is collected in
 * ~150ms on the same page — a ~350× speed-up while preserving the original
 * accessible-name semantics. See issue #876 for measurements.
 *
 * WHY the whole operation is wrapped in `raceWithTimeout`: even with bounded
 * per-CDP-call timeouts, a degenerate page (blocked main thread, thousands of
 * anchors, runaway describeNode latency) could chain enough sub-timeouts to
 * exceed the caller's `timeout` budget. The outer race guarantees the function
 * returns within `timeout`, surfacing whatever anchors were collected so far so
 * the upstream scrape phase can continue rather than tripping a retryable retry.
 * @param page - The Puppeteer page to extract anchors from.
 * @param options - Optional URL parsing options (e.g., `disableQueries`).
 * @param timeout - Total time budget in ms for the whole extraction. Defaults to {@link DEFAULT_DOM_EVALUATION_TIMEOUT}.
 * @returns An array of {@link AnchorData} objects for all HTTP(S) links found on the page.
 */
export async function getAnchorList(
	page: Page,
	options?: ParseURLOptions,
	timeout: number = DEFAULT_DOM_EVALUATION_TIMEOUT,
): Promise<AnchorData[]> {
	log('Getting anchors');

	const $anchors = await page.$$('a[href], area[href]');
	if ($anchors.length === 0) {
		log('Got 0 anchors');
		return [];
	}

	const collected: AnchorData[] = [];
	let axHits = 0;
	let textFallbacks = 0;
	// Set after the overall race trips so in-flight `resolveAnchor` calls can
	// short-circuit instead of continuing to consume CDP capacity and pushing
	// late entries into the already-returned `collected` array.
	let cancelled = false;

	const work = async () => {
		const client = getInternalCDPClient(page);
		if (cancelled) return;
		const nameByBackendId = client
			? await buildAccessibleNameMap(client, timeout)
			: new Map<number, string>();
		if (cancelled) return;

		await Promise.all(
			$anchors.map(async ($anchor) => {
				if (cancelled) return;
				const resolved = await resolveAnchor(
					$anchor,
					client,
					nameByBackendId,
					options,
					timeout,
				);
				if (cancelled || !resolved) {
					return;
				}
				if (resolved.source === 'ax') {
					axHits++;
				} else {
					textFallbacks++;
				}
				collected.push(resolved.anchor);
			}),
		);
	};

	const { timeout: timedOut } = await raceWithTimeout(work, timeout);
	cancelled = true;
	if (timedOut) {
		log(
			'getAnchorList timed out after %dms; returning %d anchors collected so far',
			timeout,
			collected.length,
		);
	}

	// Snapshot so post-return mutations from any in-flight Promise.all callback
	// (already gated by `cancelled`, but not synchronously cancellable) cannot
	// alter the array the caller now holds.
	const result = [...collected];
	log(
		'Got %d anchors (%d via AX, %d via textContent)',
		result.length,
		axHits,
		textFallbacks,
	);
	dLog(
		'Anchors are: %O',
		result.map((a) => a.href.href),
	);
	return result;
}

/**
 * Resolves a single anchor handle into an {@link AnchorData} entry, or `null`
 * if the anchor's href is not an HTTP(S) URL.
 *
 * Fires `getProp(href)` and `DOM.describeNode` in parallel, then looks up the
 * accessible name from the pre-built AX map. If the anchor is not represented
 * in the AX map (or CDP is unavailable), falls back to a lazy `textContent`
 * fetch — only paying the extra CDP round-trip when actually needed.
 * @param $anchor - The Puppeteer element handle for an anchor element.
 * @param client - The shared CDP session, or `null` if unavailable.
 * @param nameByBackendId - Map from `backendDOMNodeId` to accessible name.
 * @param options - URL parsing options.
 * @param timeout - Per-CDP-call timeout in ms.
 * @returns The resolved anchor along with the name source, or `null` when the
 *          anchor's href is not crawlable.
 */
async function resolveAnchor(
	$anchor: ElementHandle<Element>,
	client: CDPSession | null,
	nameByBackendId: ReadonlyMap<number, string>,
	options: ParseURLOptions | undefined,
	timeout: number,
): Promise<{ anchor: AnchorData; source: 'ax' | 'text' } | null> {
	try {
		const objectId = $anchor.remoteObject().objectId;
		const [hrefVal, backendNodeId] = await Promise.all([
			getProp({ $el: $anchor, propName: 'href', fallback: '' }, timeout),
			client && objectId != null
				? resolveBackendNodeId(client, objectId, timeout)
				: Promise.resolve(null),
		]);

		const href = parseUrl(hrefVal.toString(), options);
		if (!href || !href.isHTTP) {
			return null;
		}

		const axName = backendNodeId == null ? undefined : nameByBackendId.get(backendNodeId);
		if (axName !== undefined) {
			return { anchor: { href, textContent: axName }, source: 'ax' };
		}

		const textContent = await getProp(
			{ $el: $anchor, propName: 'textContent', fallback: '' },
			timeout,
		);
		return { anchor: { href, textContent: textContent.trim() }, source: 'text' };
	} catch (error) {
		// `remoteObject()` (and other synchronous handle accesses) can throw when
		// the handle is disposed (page navigated mid-extraction). Drop just this
		// anchor rather than poisoning the Promise.all over every other anchor.
		dLog('resolveAnchor failed for an anchor: %O', error);
		return null;
	}
}

/**
 * Extracts comprehensive meta information from the page's `<head>`.
 *
 * Collects all metadata in a single `page.evaluate` call (14 CDP round-trips
 * collapsed into 1) wrapped in {@link raceWithTimeout}. On timeout (an unresponsive
 * page) a minimal `{ title: '' }` is returned rather than hanging.
 *
 * Collected metadata:
 * - `title` - The document title.
 * - `lang` - The `lang` attribute of the `<html>` element.
 * - `description` - The `<meta name="description">` content.
 * - `keywords` - The `<meta name="keywords">` content.
 * - `noindex` / `nofollow` / `noarchive` - Parsed from the `<meta name="robots">` directives.
 * - `canonical` - The `<link rel="canonical">` content.
 * - `alternate` - The `<link rel="alternate">` content.
 * - Open Graph tags: `og:type`, `og:title`, `og:site_name`, `og:description`, `og:url`, `og:image`.
 * - `twitter:card` - The Twitter Card type.
 * @param page - The Puppeteer page to extract meta information from.
 * @param timeout - Timeout in ms for the evaluation. Defaults to {@link DEFAULT_DOM_EVALUATION_TIMEOUT}.
 * @returns An object containing all extracted meta properties.
 */
export async function getMeta(
	page: Page,
	timeout: number = DEFAULT_DOM_EVALUATION_TIMEOUT,
): Promise<Meta> {
	log('Getting Meta');

	const { result, timeout: timedOut } = await raceWithTimeout(
		() =>
			page
				.evaluate(() => {
					/* global document, HTMLMetaElement, HTMLLinkElement */
					const content = (selector: string): string => {
						const el = document.querySelector(selector);
						return el instanceof HTMLMetaElement ? el.content : '';
					};
					const linkHref = (selector: string): string => {
						const el = document.querySelector(selector);
						return el instanceof HTMLLinkElement ? el.href : '';
					};
					return {
						title: document.title,
						lang: document.documentElement.lang,
						description: content('meta[name="description"]'),
						keywords: content('meta[name="keywords"]'),
						robots: content('meta[name="robots"]'),
						canonical: linkHref('link[rel="canonical"]'),
						alternate: linkHref('link[rel="alternate"]'),
						'og:type': content('meta[property="og:type"]'),
						'og:title': content('meta[property="og:title"]'),
						'og:site_name': content('meta[property="og:site_name"]'),
						'og:description': content('meta[property="og:description"]'),
						'og:url': content('meta[property="og:url"]'),
						'og:image': content('meta[property="og:image"]'),
						'twitter:card': content('meta[name="twitter:card"]'),
					};
				})
				.catch(() => null),
		timeout,
	);

	if (timedOut || result == null) {
		log('Meta extraction timed out or failed; returning fallback');
		return { title: '' };
	}

	const { robots: robotsVal, ...rest } = result;
	const robots = new Set(robotsVal.split(',').map((robot) => robot.trim().toLowerCase()));
	const meta: Meta = {
		...rest,
		noindex: robots.has('noindex'),
		nofollow: robots.has('nofollow'),
		noarchive: robots.has('noarchive'),
	};

	log('Got meta');
	dLog('Meta data are: %O', meta);
	return meta;
}
