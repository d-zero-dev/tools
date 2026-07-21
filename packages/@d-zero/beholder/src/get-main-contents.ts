/**
 * Main-content quantitative extraction for scraped HTML pages.
 *
 * Runs entirely against a `Document` (Puppeteer page realm or jsdom) so the
 * same logic is unit-tested without a browser. Puppeteer callers use
 * {@link getMainContents}, which passes this function into `page.evaluate`.
 *
 * WHY no `@medv/finder`: selector strings are diagnostic only; a tag+id+class // cspell:disable-line
 * path is enough and avoids a Node-only dependency inside the page realm.
 * @module
 */

import type { MainContentsData } from './types.js';
import type { Page } from 'puppeteer';

/**
 * Extract main-content metrics from a `Document`.
 *
 * This function must remain free of closure over imports so Puppeteer can
 * serialize it into `page.evaluate`.
 *
 * Argument order matches `page.evaluate(fn, mainContentSelector)`: the selector
 * is the first argument; `doc` defaults to the page-realm global `document`
 * when omitted (jsdom tests pass an explicit `Document` as the second argument).
 * @param mainContentSelector - Optional selector prepended to the default list.
 * @param doc - The document to inspect (defaults to the global `document`).
 * @returns Quantitative main-content data (never `null`; empty when no main region).
 * @example
 * ```ts
 * // In page.evaluate / browser:
 * const data = extractMainContentsFromDocument('#page-body');
 * // In jsdom tests:
 * const data = extractMainContentsFromDocument('#page-body', document);
 * ```
 */
export function extractMainContentsFromDocument(
	mainContentSelector: string | null = null,
	doc: Document = document,
): MainContentsData {
	/**
	 * @param text
	 */
	function removeSpaces(text: string | null): string | null {
		return text?.trim().replaceAll(/\s+/g, '') || null;
	}

	/**
	 * @param value
	 */
	function cssEscape(value: string): string {
		if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
			return CSS.escape(value);
		}
		return value.replaceAll(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
	}

	/**
	 * @param el
	 */
	function buildSelector(el: Element): string {
		const tag = el.nodeName.toLowerCase();
		const id = el.id ? `#${cssEscape(el.id)}` : '';
		const classes = [...el.classList].map((c) => `.${cssEscape(c)}`).join('');
		return `${tag}${id}${classes}`;
	}

	/**
	 * @param media
	 */
	function resolveMediaSrc(media: HTMLMediaElement): string {
		if (media.currentSrc) {
			return media.currentSrc;
		}
		const attrSrc = media.getAttribute('src');
		if (attrSrc) {
			try {
				return new URL(attrSrc, doc.baseURI).href;
			} catch {
				return attrSrc;
			}
		}
		const source = media.querySelector('source[src]');
		const sourceSrc = source?.getAttribute('src');
		if (sourceSrc) {
			try {
				return new URL(sourceSrc, doc.baseURI).href;
			} catch {
				return sourceSrc;
			}
		}
		return '';
	}

	const title = doc.title?.trim() ?? '';
	const bodyWordCount = removeSpaces(doc.body?.textContent ?? null)?.length ?? 0;

	const selectors = [
		'main',
		'[role="main"]',
		'#main',
		'.main',
		'#content',
		'.content',
		'#contents',
		'.contents',
		'#main-content',
		'.main-content',
		'#main_content',
		'.main_content',
		'#mainContent',
		'.mainContent',
	];
	if (mainContentSelector) {
		selectors.unshift(mainContentSelector);
	}

	let $main: Element | null = null;
	try {
		$main = doc.querySelector(selectors.join(','));
	} catch {
		// Invalid custom selector: retry without it so built-in selectors still run.
		if (mainContentSelector) {
			selectors.shift();
			$main = doc.querySelector(selectors.join(','));
		}
	}

	if (!$main) {
		const fallbackSelectors = [
			'[id*="main" i]',
			'[class*="main" i]',
			'[id*="content" i]',
			'[class*="content" i]',
		];
		for (const sel of fallbackSelectors) {
			const candidate = doc.querySelector(sel);
			if (candidate && candidate !== doc.body && candidate !== doc.documentElement) {
				$main = candidate;
				break;
			}
		}
	}

	if (!$main) {
		return {
			title,
			main: null,
			wordCount: 0,
			bodyWordCount,
			headings: [],
			images: [],
			tables: [],
			buttons: [],
			iframes: [],
			videos: [],
			audios: [],
			canvases: [],
		};
	}

	const headings: MainContentsData['headings'] = [];
	for (const $heading of $main.querySelectorAll<HTMLHeadingElement>(
		'h1, h2, h3, h4, h5, h6',
	)) {
		headings.push({
			text: removeSpaces($heading.textContent),
			level: Number.parseInt($heading.nodeName.replace(/h/i, ''), 10) as
				1 | 2 | 3 | 4 | 5 | 6,
		});
	}

	const images: MainContentsData['images'] = [];
	for (const $img of $main.querySelectorAll<HTMLImageElement>(
		'img, input[type="image"]',
	)) {
		images.push({
			src: $img.src,
			alt: $img.alt,
		});
	}

	const tables: MainContentsData['tables'] = [];
	for (const $table of $main.querySelectorAll<HTMLTableElement>('table')) {
		tables.push({
			rows: $table.querySelectorAll('tr').length,
			cols: $table.querySelector('tr')?.querySelectorAll('th, td').length || 0,
			hasHeader: !!$table.querySelector('thead'),
			hasFooter: !!$table.querySelector('tfoot'),
			hasMergedCell: !!$table.querySelector('[colspan], [rowspan]'),
		});
	}

	const win = doc.defaultView;
	const HTMLButton = win?.HTMLButtonElement;
	const HTMLInput = win?.HTMLInputElement;

	const buttons: MainContentsData['buttons'] = [];
	for (const $el of $main.querySelectorAll(
		'button, [role="button"], [class*="button"], [class*="btn"]',
	)) {
		const isButton = HTMLButton ? $el instanceof HTMLButton : $el.nodeName === 'BUTTON';
		const isInput = HTMLInput ? $el instanceof HTMLInput : $el.nodeName === 'INPUT';
		const isFormControl = isButton || isInput;
		let text = removeSpaces($el.textContent);
		if (!text && isInput) {
			text = removeSpaces($el.getAttribute('value'));
		}
		const disabledProp =
			isFormControl && 'disabled' in $el
				? Boolean(($el as HTMLButtonElement).disabled)
				: false;
		buttons.push({
			nodeName: $el.nodeName,
			role: $el.getAttribute('role'),
			type: isFormControl ? ($el as HTMLButtonElement | HTMLInputElement).type : null,
			text,
			disabled: disabledProp || $el.getAttribute('aria-disabled') === 'true',
		});
	}

	const iframes: MainContentsData['iframes'] = [];
	for (const $el of $main.querySelectorAll<HTMLIFrameElement>('iframe')) {
		iframes.push({
			src: $el.src,
			title: $el.hasAttribute('title') ? $el.getAttribute('title') : null,
			width: $el.getAttribute('width'),
			height: $el.getAttribute('height'),
		});
	}

	const videos: MainContentsData['videos'] = [];
	for (const $el of $main.querySelectorAll<HTMLVideoElement>('video')) {
		const posterAttr = $el.getAttribute('poster');
		let poster: string | null = null;
		if (posterAttr) {
			try {
				poster = new URL(posterAttr, doc.baseURI).href;
			} catch {
				poster = posterAttr;
			}
		}
		videos.push({
			src: resolveMediaSrc($el),
			poster,
			width: $el.width,
			height: $el.height,
		});
	}

	const audios: MainContentsData['audios'] = [];
	for (const $el of $main.querySelectorAll<HTMLAudioElement>('audio')) {
		audios.push({
			src: resolveMediaSrc($el),
		});
	}

	const canvases: MainContentsData['canvases'] = [];
	for (const $el of $main.querySelectorAll<HTMLCanvasElement>('canvas')) {
		canvases.push({
			width: $el.width,
			height: $el.height,
		});
	}

	return {
		title,
		main: {
			nodeName: $main.nodeName,
			id: $main.id || null,
			classList: [...$main.classList],
			role: $main.getAttribute('role'),
			selector: buildSelector($main),
		},
		wordCount: removeSpaces($main.textContent)?.length ?? 0,
		bodyWordCount,
		headings,
		images,
		tables,
		buttons,
		iframes,
		videos,
		audios,
		canvases,
	};
}

/**
 * Extract main-content metrics from a Puppeteer page via a single `page.evaluate`.
 * @param page - Puppeteer page whose DOM has finished loading.
 * @param options - Optional main-content selector override.
 * @param options.mainContentSelector
 * @returns Quantitative main-content data.
 * @example
 * ```ts
 * const mainContents = await getMainContents(page, { mainContentSelector: '#page-body' });
 * ```
 */
export async function getMainContents(
	page: Page,
	options?: { mainContentSelector?: string | null },
): Promise<MainContentsData> {
	return page.evaluate(
		extractMainContentsFromDocument,
		options?.mainContentSelector ?? null,
	);
}
