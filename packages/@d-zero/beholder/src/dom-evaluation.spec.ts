import type { ElementHandle, Page } from 'puppeteer';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_DOM_EVALUATION_TIMEOUT,
	getAnchorList,
	getImageList,
	getMeta,
	getProp,
} from './dom-evaluation.js';

afterEach(() => {
	vi.useRealTimers();
});

/**
 * Builds a minimal `Page` mock whose `evaluate` resolves with the given value.
 * @param value
 */
function mockPageEvaluate(value: unknown): Page {
	return {
		evaluate: () => Promise.resolve(value),
	} as unknown as Page;
}

/**
 * Builds an `ElementHandle` mock returning the given property value.
 * @param value
 */
function mockElementHandle(value: unknown): ElementHandle<Element> {
	return {
		getProperty: () =>
			Promise.resolve({
				jsonValue: () => Promise.resolve(value),
			}),
	} as unknown as ElementHandle<Element>;
}

describe('getMeta', () => {
	it('maps raw evaluation result into a Meta object and parses robots directives', async () => {
		const page = mockPageEvaluate({
			title: 'Example',
			lang: 'ja',
			description: 'desc',
			keywords: 'a,b',
			robots: 'noindex, NOFOLLOW',
			canonical: 'https://example.com/',
			alternate: 'https://example.com/en',
			'og:type': 'website',
			'og:title': 'OG Title',
			'og:site_name': 'Site',
			'og:description': 'OG desc',
			'og:url': 'https://example.com/',
			'og:image': 'https://example.com/img.png',
			'twitter:card': 'summary',
		});

		const meta = await getMeta(page);

		expect(meta).toStrictEqual({
			title: 'Example',
			lang: 'ja',
			description: 'desc',
			keywords: 'a,b',
			noindex: true,
			nofollow: true,
			noarchive: false,
			canonical: 'https://example.com/',
			alternate: 'https://example.com/en',
			'og:type': 'website',
			'og:title': 'OG Title',
			'og:site_name': 'Site',
			'og:description': 'OG desc',
			'og:url': 'https://example.com/',
			'og:image': 'https://example.com/img.png',
			'twitter:card': 'summary',
		});
	});

	it('returns a minimal fallback when evaluation rejects', async () => {
		const page = {
			evaluate: () => Promise.reject(new Error('execution context destroyed')),
		} as unknown as Page;

		const meta = await getMeta(page);

		expect(meta).toStrictEqual({ title: '' });
	});

	it('returns a minimal fallback when the main thread is unresponsive (timeout)', async () => {
		vi.useFakeTimers();
		const page = {
			// Never resolves — simulates a blocked main thread.
			evaluate: () => new Promise(() => {}),
		} as unknown as Page;

		const promise = getMeta(page, 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const meta = await promise;

		expect(meta).toStrictEqual({ title: '' });
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('getImageList', () => {
	it('maps raw images, deriving isLazy and recording the viewport width', async () => {
		const page = mockPageEvaluate([
			{
				src: 'https://example.com/a.png',
				currentSrc: 'https://example.com/a.png',
				alt: 'A',
				width: 100,
				height: 50,
				naturalWidth: 200,
				naturalHeight: 100,
				loading: 'LAZY',
				sourceCode: '<img>',
			},
			{
				src: 'https://example.com/b.png',
				currentSrc: 'https://example.com/b.png',
				alt: 'B',
				width: 0,
				height: 0,
				naturalWidth: 0,
				naturalHeight: 0,
				loading: 'eager',
				sourceCode: '<img>',
			},
		]);

		const images = await getImageList(page, 375);

		expect(images).toStrictEqual([
			{
				src: 'https://example.com/a.png',
				currentSrc: 'https://example.com/a.png',
				alt: 'A',
				width: 100,
				height: 50,
				naturalWidth: 200,
				naturalHeight: 100,
				isLazy: true,
				viewportWidth: 375,
				sourceCode: '<img>',
			},
			{
				src: 'https://example.com/b.png',
				currentSrc: 'https://example.com/b.png',
				alt: 'B',
				width: 0,
				height: 0,
				naturalWidth: 0,
				naturalHeight: 0,
				isLazy: false,
				viewportWidth: 375,
				sourceCode: '<img>',
			},
		]);
	});

	it('returns an empty array when extraction rejects', async () => {
		const page = {
			evaluate: () => Promise.reject(new Error('execution context destroyed')),
		} as unknown as Page;

		const images = await getImageList(page, 375);

		expect(images).toStrictEqual([]);
	});

	it('returns an empty array (not a failure fallback) for a page with no images', async () => {
		const page = mockPageEvaluate([]);

		const images = await getImageList(page, 375);

		expect(images).toStrictEqual([]);
	});

	it('returns an empty array when extraction times out', async () => {
		vi.useFakeTimers();
		const page = {
			evaluate: () => new Promise(() => {}),
		} as unknown as Page;

		const promise = getImageList(page, 375, 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const images = await promise;

		expect(images).toStrictEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('getProp', () => {
	it('returns the property value and clears the loser-side timer', async () => {
		vi.useFakeTimers();
		const $el = mockElementHandle('hello');

		const result = await getProp({ $el, propName: 'textContent', fallback: '' });

		expect(result).toBe('hello');
		// raceWithTimeout must clear the timeout it lost so it cannot keep the event loop alive.
		expect(vi.getTimerCount()).toBe(0);
	});

	it('returns the fallback when property retrieval throws', async () => {
		const $el = {
			getProperty: () => Promise.reject(new Error('detached')),
		} as unknown as ElementHandle<Element>;

		const result = await getProp({ $el, propName: 'textContent', fallback: 'fb' });

		expect(result).toBe('fb');
	});

	it('returns the fallback when retrieval hangs past the timeout', async () => {
		vi.useFakeTimers();
		const $el = {
			getProperty: () => new Promise(() => {}),
		} as unknown as ElementHandle<Element>;

		const promise = getProp({ $el, propName: 'textContent', fallback: 'fb' }, 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const result = await promise;

		expect(result).toBe('fb');
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('getAnchorList', () => {
	it('resolves the href and prefers the accessible name from the accessibility tree', async () => {
		const $anchor = mockElementHandle('https://example.com/page');
		const page = {
			$$: () => Promise.resolve([$anchor]),
			accessibility: {
				snapshot: () => Promise.resolve({ name: 'Accessible Name' }),
			},
		} as unknown as Page;

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Accessible Name');
		expect(anchors[0]?.href.href).toBe('https://example.com/page');
	});

	it('falls back to trimmed textContent when the accessibility tree has no node', async () => {
		const $anchor = {
			getProperty: vi
				.fn()
				// First getProp call reads `href`, second reads `textContent`.
				.mockResolvedValueOnce({
					jsonValue: () => Promise.resolve('https://example.com/page'),
				})
				.mockResolvedValueOnce({ jsonValue: () => Promise.resolve('  Link text  ') }),
		} as unknown as ElementHandle<Element>;
		const page = {
			$$: () => Promise.resolve([$anchor]),
			accessibility: {
				snapshot: () => Promise.resolve(null),
			},
		} as unknown as Page;

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Link text');
	});

	it('skips non-HTTP links', async () => {
		const $anchor = mockElementHandle('javascript:void(0)');
		const page = {
			$$: () => Promise.resolve([$anchor]),
			accessibility: {
				snapshot: () => Promise.resolve(null),
			},
		} as unknown as Page;

		const anchors = await getAnchorList(page);

		expect(anchors).toStrictEqual([]);
	});
});

describe('DEFAULT_DOM_EVALUATION_TIMEOUT', () => {
	it('defaults to 30 seconds', () => {
		expect(DEFAULT_DOM_EVALUATION_TIMEOUT).toBe(30_000);
	});
});
