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
import type { ElementHandle, Page } from 'puppeteer';

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
 */
export const DEFAULT_DOM_EVALUATION_TIMEOUT = 30_000;

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
 * Extracts all anchor (`<a>` and `<area>`) elements with `href` attributes from the page.
 *
 * For each anchor, resolves the `href` to an `ExURL` via `parseUrl`, retrieves
 * the accessible name (from the accessibility tree, falling back to `textContent`),
 * and filters out non-HTTP links.
 *
 * WHY this keeps per-element CDP calls (unlike {@link getMeta} / {@link getImageList}):
 * the accessible name comes from Chrome's computed accessibility tree
 * (`page.accessibility.snapshot`), which is a CDP-only feature unavailable to in-page
 * DOM APIs. Each {@link getProp} read is still bounded by `timeout`.
 * @param page - The Puppeteer page to extract anchors from.
 * @param options - Optional URL parsing options (e.g., `disableQueries`).
 * @param timeout - Timeout in ms per property read. Defaults to {@link DEFAULT_DOM_EVALUATION_TIMEOUT}.
 * @returns An array of {@link AnchorData} objects for all HTTP(S) links found on the page.
 */
export async function getAnchorList(
	page: Page,
	options?: ParseURLOptions,
	timeout: number = DEFAULT_DOM_EVALUATION_TIMEOUT,
) {
	log('Getting anchors');

	const $anchors = await page.$$('a[href], area[href]');
	const anchorList: AnchorData[] = [];

	for (const $anchor of $anchors) {
		const $href = await getProp(
			{ $el: $anchor, propName: 'href', fallback: '' },
			timeout,
		);
		const hrefVal = $href.toString();
		const href = parseUrl(hrefVal, options);
		if (!href || !href.isHTTP) {
			continue;
		}
		const axNode = await page.accessibility.snapshot({ root: $anchor });
		const textContent = await getProp(
			{ $el: $anchor, propName: 'textContent', fallback: '' },
			timeout,
		);
		const accessibleName = axNode ? axNode.name || '' : textContent.trim();
		const link: AnchorData = {
			href,
			textContent: accessibleName,
		};
		anchorList.push(link);
	}

	log('Got %d anchors', anchorList.length);
	dLog(
		'Anchors are: %O',
		anchorList.map((a) => a.href.href),
	);
	return anchorList;
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
