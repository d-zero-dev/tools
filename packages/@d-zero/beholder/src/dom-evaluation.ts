import type { AnchorData, ImageElement, ParseURLOptions } from './types.js';
import type { ElementHandle, Page } from 'puppeteer';

import { domDetailsLog, domLog } from './debug.js';
import { parseUrl } from './utils.js';

const pid = `${process.pid}`;
const log = domLog.extend(pid);
const dLog = domDetailsLog.extend(pid);

export async function getProp<T>(
	$el: ElementHandle<Element>,
	propName: string,
	fallback: T,
) {
	return Promise.race([
		_getProp($el, propName, fallback),
		new Promise<T>((res) => setTimeout(() => res(fallback), 10 * 1000)),
	]);
}

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

export async function getPropBySelector<T>(
	page: Page,
	selector: string,
	propName: string,
	fallback: T,
) {
	const $el = await page.$(selector);
	if (!$el) {
		return fallback;
	}

	return getProp($el, propName, fallback);
}

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
		const src = await getProp($image, 'src', '');
		const currentSrc = await getProp($image, 'currentSrc', '');
		const alt = await getProp($image, 'alt', '');
		const naturalWidth = await getProp($image, 'naturalWidth', 0);
		const naturalHeight = await getProp($image, 'naturalHeight', 0);
		const loading = await getProp($image, 'loading', '');
		const sourceCode = await getProp($image, 'outerHTML', '');
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

export async function getAnchorList(page: Page, options?: ParseURLOptions) {
	log('Getting anchors');

	const $anchors = await page.$$('a[href], area[href]');
	const anchorList: AnchorData[] = [];

	for (const $anchor of $anchors) {
		const $href = await getProp($anchor, 'href', '');
		const hrefVal = $href.toString();
		const href = parseUrl(hrefVal, options);
		if (!href || !href.isHTTP) {
			continue;
		}
		const axNode = await page.accessibility.snapshot({ root: $anchor });
		const textContent = await getProp($anchor, 'textContent', '');
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

export async function getMeta(page: Page) {
	log('Getting Meta');

	const robotsVal = await getPropBySelector(page, 'meta[name="robots"]', 'content', '');
	const robots = new Set(robotsVal.split(',').map((robot) => robot.trim().toLowerCase()));
	const meta = {
		title: await getPropBySelector(page, 'title', 'textContent', ''),
		lang: await getPropBySelector(page, 'html', 'lang', ''),
		description: await getPropBySelector(page, 'meta[name="description"]', 'content', ''),
		keywords: await getPropBySelector(page, 'meta[name="keywords"]', 'content', ''),
		noindex: robots.has('noindex'),
		nofollow: robots.has('nofollow'),
		noarchive: robots.has('noarchive'),
		canonical: await getPropBySelector(page, 'link[rel="canonical"]', 'content', ''),
		alternate: await getPropBySelector(page, 'link[rel="alternate"]', 'content', ''),
		'og:type': await getPropBySelector(page, 'meta[property="og:type"]', 'content', ''),
		'og:title': await getPropBySelector(page, 'meta[property="og:title"]', 'content', ''),
		'og:site_name': await getPropBySelector(
			page,
			'meta[property="og:site_name"]',
			'content',
			'',
		),
		'og:description': await getPropBySelector(
			page,
			'meta[property="og:description"]',
			'content',
			'',
		),
		'og:url': await getPropBySelector(page, 'meta[property="og:url"]', 'content', ''),
		'og:image': await getPropBySelector(page, 'meta[property="og:image"]', 'content', ''),
		'twitter:card': await getPropBySelector(
			page,
			'meta[name="twitter:card"]',
			'content',
			'',
		),
	};

	log('Got meta');
	dLog('Meta data are: %O', meta);
	return meta;
}
