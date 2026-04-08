/**
 * DOM evaluation functions for extracting structured data from Puppeteer pages.
 *
 * These functions are called by {@link ./scraper.ts | Scraper.#fetchData} to extract
 * anchors, images, and meta information after page navigation completes.
 * @see {@link ./types.ts} for the data types returned by these functions
 */

import type { AnchorData, ImageElement, ParseURLOptions } from './types.js';
import type { ElementHandle, Page } from 'puppeteer';

import { domDetailsLog, domLog } from './debug.js';
import { parseUrl } from './parse-url.js';

const pid = `${process.pid}`;
const log = domLog.extend(pid);
const dLog = domDetailsLog.extend(pid);

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
 * Races the actual property retrieval against a 10-second timeout.
 * If the property cannot be read or the timeout expires, the fallback value is returned.
 * @template T - The expected type of the property value.
 * @param params - Parameters containing the element, property name, and fallback.
 * @returns The property value, or the fallback if retrieval fails.
 */
export async function getProp<T>(params: GetPropParams<T>) {
	const { $el, propName, fallback } = params;
	return Promise.race([
		_getProp($el, propName, fallback),
		new Promise<T>((res) => setTimeout(() => res(fallback), 10 * 1000)),
	]);
}

/**
 * Internal implementation of property retrieval without timeout.
 * @template T - The expected type of the property value.
 * @param $el - The Puppeteer element handle.
 * @param propName - The DOM property name.
 * @param fallback - The default value on failure.
 * @returns The property value cast to `T`, or the fallback.
 */
async function _getProp<T>($el: ElementHandle<Element>, propName: string, fallback: T) {
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
 * Parameters for {@link getPropBySelector}.
 * @template T - The expected type of the property value.
 */
export interface GetPropBySelectorParams<T> {
	/** The Puppeteer page to query. */
	readonly page: Page;
	/** A CSS selector to find the target element. */
	readonly selector: string;
	/** The DOM property name to read from the matched element. */
	readonly propName: string;
	/** The default value if no element matches or the property cannot be read. */
	readonly fallback: T;
}

/**
 * Retrieves a DOM property value from the first element matching a CSS selector.
 *
 * Combines `page.$()` with {@link getProp} for convenient single-element lookups.
 * @template T - The expected type of the property value.
 * @param params - Parameters containing the page, selector, property name, and fallback.
 * @returns The property value, or the fallback if the element is not found or retrieval fails.
 */
export async function getPropBySelector<T>(params: GetPropBySelectorParams<T>) {
	const { page, selector, propName, fallback } = params;
	const $el = await page.$(selector);
	if (!$el) {
		return fallback;
	}

	return getProp({ $el, propName, fallback });
}

/**
 * Extracts all `<img>` elements from the page and returns their properties.
 *
 * For each image, collects the `src`, `currentSrc`, `alt`, bounding box dimensions,
 * natural dimensions, lazy-loading status, and the outer HTML source code.
 * @param page - The Puppeteer page to extract images from.
 * @param viewportWidth - The current viewport width in pixels, recorded alongside each image entry.
 * @returns An array of {@link ImageElement} objects describing each image on the page.
 */
export async function getImageList(
	page: Page,
	viewportWidth: number,
): Promise<ImageElement[]> {
	log('Getting images (Viewport: %dpx)', viewportWidth);

	const $images = await page.$$('img');
	const imageList: {
		src: string;
		currentSrc: string;
		alt: string;
		width: number;
		height: number;
		naturalWidth: number;
		naturalHeight: number;
		isLazy: boolean;
		viewportWidth: number;
		sourceCode: string;
	}[] = [];
	for (const $image of $images) {
		const boundingBox = await $image.boundingBox();
		const width = boundingBox?.width || 0;
		const height = boundingBox?.height || 0;
		const src = await getProp({ $el: $image, propName: 'src', fallback: '' });
		const currentSrc = await getProp({
			$el: $image,
			propName: 'currentSrc',
			fallback: '',
		});
		const alt = await getProp({ $el: $image, propName: 'alt', fallback: '' });
		const naturalWidth = await getProp({
			$el: $image,
			propName: 'naturalWidth',
			fallback: 0,
		});
		const naturalHeight = await getProp({
			$el: $image,
			propName: 'naturalHeight',
			fallback: 0,
		});
		const loading = await getProp({ $el: $image, propName: 'loading', fallback: '' });
		const sourceCode = await getProp({
			$el: $image,
			propName: 'outerHTML',
			fallback: '',
		});
		const isLazy = loading.toLowerCase().trim() === 'lazy';
		imageList.push({
			src,
			currentSrc,
			alt,
			width,
			height,
			naturalWidth,
			naturalHeight,
			isLazy,
			viewportWidth,
			sourceCode,
		});
	}

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
 * @param page - The Puppeteer page to extract anchors from.
 * @param options - Optional URL parsing options (e.g., `disableQueries`).
 * @returns An array of {@link AnchorData} objects for all HTTP(S) links found on the page.
 */
export async function getAnchorList(page: Page, options?: ParseURLOptions) {
	log('Getting anchors');

	const $anchors = await page.$$('a[href], area[href]');
	const anchorList: AnchorData[] = [];

	for (const $anchor of $anchors) {
		const $href = await getProp({ $el: $anchor, propName: 'href', fallback: '' });
		const hrefVal = $href.toString();
		const href = parseUrl(hrefVal, options);
		if (!href || !href.isHTTP) {
			continue;
		}
		const axNode = await page.accessibility.snapshot({ root: $anchor });
		const textContent = await getProp({
			$el: $anchor,
			propName: 'textContent',
			fallback: '',
		});
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
 * Collects the following metadata:
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
 * @returns An object containing all extracted meta properties.
 */
export async function getMeta(page: Page) {
	log('Getting Meta');

	const robotsVal = await getPropBySelector({
		page,
		selector: 'meta[name="robots"]',
		propName: 'content',
		fallback: '',
	});
	const robots = new Set(robotsVal.split(',').map((robot) => robot.trim().toLowerCase()));
	const meta = {
		title: await getPropBySelector({
			page,
			selector: 'title',
			propName: 'textContent',
			fallback: '',
		}),
		lang: await getPropBySelector({
			page,
			selector: 'html',
			propName: 'lang',
			fallback: '',
		}),
		description: await getPropBySelector({
			page,
			selector: 'meta[name="description"]',
			propName: 'content',
			fallback: '',
		}),
		keywords: await getPropBySelector({
			page,
			selector: 'meta[name="keywords"]',
			propName: 'content',
			fallback: '',
		}),
		noindex: robots.has('noindex'),
		nofollow: robots.has('nofollow'),
		noarchive: robots.has('noarchive'),
		canonical: await getPropBySelector({
			page,
			selector: 'link[rel="canonical"]',
			propName: 'href',
			fallback: '',
		}),
		alternate: await getPropBySelector({
			page,
			selector: 'link[rel="alternate"]',
			propName: 'href',
			fallback: '',
		}),
		'og:type': await getPropBySelector({
			page,
			selector: 'meta[property="og:type"]',
			propName: 'content',
			fallback: '',
		}),
		'og:title': await getPropBySelector({
			page,
			selector: 'meta[property="og:title"]',
			propName: 'content',
			fallback: '',
		}),
		'og:site_name': await getPropBySelector({
			page,
			selector: 'meta[property="og:site_name"]',
			propName: 'content',
			fallback: '',
		}),
		'og:description': await getPropBySelector({
			page,
			selector: 'meta[property="og:description"]',
			propName: 'content',
			fallback: '',
		}),
		'og:url': await getPropBySelector({
			page,
			selector: 'meta[property="og:url"]',
			propName: 'content',
			fallback: '',
		}),
		'og:image': await getPropBySelector({
			page,
			selector: 'meta[property="og:image"]',
			propName: 'content',
			fallback: '',
		}),
		'twitter:card': await getPropBySelector({
			page,
			selector: 'meta[name="twitter:card"]',
			propName: 'content',
			fallback: '',
		}),
	};

	log('Got meta');
	dLog('Meta data are: %O', meta);
	return meta;
}
