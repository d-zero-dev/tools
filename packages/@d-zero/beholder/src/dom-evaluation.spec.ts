import type { ElementHandle, Page } from 'puppeteer';

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_DOM_EVALUATION_TIMEOUT,
	getAnchorList,
	getImageList,
	getMeta,
	getProp,
} from './dom-evaluation.js';
import { emptyMeta } from './meta/classify.js';

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
	it('returns emptyMeta() when page.evaluate rejects', async () => {
		const page = {
			evaluate: () => Promise.reject(new Error('execution context destroyed')),
			content: () => Promise.resolve('<html></html>'),
		} as unknown as Page;

		const meta = await getMeta(page, { url: 'https://example.com/' });

		expect(meta).toEqual(emptyMeta());
	});

	it('returns emptyMeta() when the main thread is unresponsive (timeout)', async () => {
		vi.useFakeTimers();
		const page = {
			// Never resolves — simulates a blocked main thread.
			evaluate: () => new Promise(() => {}),
			content: () => new Promise(() => {}),
		} as unknown as Page;

		const promise = getMeta(page, { url: 'https://example.com/' }, 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const meta = await promise;

		expect(meta).toEqual(emptyMeta());
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

/**
 * Builds an anchor element handle whose `remoteObject().objectId` and per-property
 * reads can be customized for the new Strategy F implementation.
 * @param objectId The remote object id used to map this handle back to an AX node.
 * @param props Property values returned by `getProperty(propName).jsonValue()`.
 */
function mockAnchorHandle(
	objectId: string,
	props: Record<string, unknown>,
): ElementHandle<Element> {
	return {
		remoteObject: () => ({ objectId }),
		getProperty: (propName: string) =>
			Promise.resolve({
				jsonValue: () => Promise.resolve(props[propName] ?? ''),
			}),
	} as unknown as ElementHandle<Element>;
}

/**
 * Builds a page mock for the new `getAnchorList` implementation, wiring up
 * `_client()` to return a stub CDP session whose `send(method)` is dispatched
 * by `axNodes`/`describeNodes` (matched by `objectId`).
 * @param args - Mock configuration.
 * @param args.anchors - Anchor element handles to be returned by `page.$$()`.
 * @param args.axNodes - Raw AX nodes returned by `Accessibility.getFullAXTree`.
 * @param args.describeNodes - Map from `objectId` → `backendNodeId` for `DOM.describeNode`.
 * @param args.getFullAXTree - Optional override for `Accessibility.getFullAXTree` (e.g., simulate rejection).
 * @param args.describeNode - Optional override for `DOM.describeNode` (e.g., simulate rejection).
 */
function mockPageForAnchors(args: {
	anchors: ElementHandle<Element>[];
	axNodes?: Array<{
		backendDOMNodeId?: number;
		ignored?: boolean;
		name?: { value?: unknown };
	}>;
	describeNodes?: Record<string, number | undefined>;
	getFullAXTree?: () => Promise<unknown>;
	describeNode?: (params: { objectId: string }) => Promise<unknown>;
}): Page {
	const { anchors, axNodes = [], describeNodes = {}, getFullAXTree, describeNode } = args;
	const client = {
		send: (method: string, params?: { objectId?: string }) => {
			if (method === 'Accessibility.getFullAXTree') {
				return getFullAXTree ? getFullAXTree() : Promise.resolve({ nodes: axNodes });
			}
			if (method === 'DOM.describeNode') {
				if (describeNode) return describeNode({ objectId: params?.objectId ?? '' });
				const backendNodeId =
					params?.objectId == null ? undefined : describeNodes[params.objectId];
				return Promise.resolve({ node: { backendNodeId } });
			}
			return Promise.reject(new Error(`unexpected CDP method: ${method}`));
		},
	};
	return {
		$$: () => Promise.resolve(anchors),
		_client: () => client,
	} as unknown as Page;
}

describe('getAnchorList', () => {
	it('resolves the href and uses the accessible name from the AX tree', async () => {
		const $anchor = mockAnchorHandle('obj-1', { href: 'https://example.com/page' });
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 42, name: { value: 'Accessible Name' } }],
			describeNodes: { 'obj-1': 42 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Accessible Name');
		expect(anchors[0]?.href.href).toBe('https://example.com/page');
	});

	it('uses an empty AX name as-is without falling back to textContent', async () => {
		// Mirrors the old `axNode.name || ''` behavior: when the AX tree DOES contain
		// the anchor (so it's not "missing from the tree") but its computed name is
		// empty, we keep the empty string — no textContent fallback.
		const textContent = vi.fn();
		const $anchor = {
			remoteObject: () => ({ objectId: 'obj-1' }),
			getProperty: (propName: string) => {
				if (propName === 'href') {
					return Promise.resolve({
						jsonValue: () => Promise.resolve('https://example.com/page'),
					});
				}
				textContent();
				return Promise.resolve({ jsonValue: () => Promise.resolve('text fallback') });
			},
		} as unknown as ElementHandle<Element>;
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 42, name: { value: '' } }],
			describeNodes: { 'obj-1': 42 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('');
		expect(textContent).not.toHaveBeenCalled();
	});

	it('falls back to textContent for ignored AX nodes (aria-hidden / display:none anchors)', async () => {
		// Mirrors puppeteer's high-level snapshot({root}) with interestingOnly:true,
		// which returns null for ignored nodes — old code then used textContent.
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: 'Visible text',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 42, ignored: true, name: { value: '' } }],
			describeNodes: { 'obj-1': 42 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Visible text');
	});

	it('drops a single anchor whose handle throws (detached) without rejecting the whole list', async () => {
		const $detached = {
			remoteObject: () => {
				throw new Error('Handle is detached');
			},
		} as unknown as ElementHandle<Element>;
		const $good = mockAnchorHandle('obj-1', { href: 'https://example.com/page' });
		const page = mockPageForAnchors({
			anchors: [$detached, $good],
			axNodes: [{ backendDOMNodeId: 42, name: { value: 'Name' } }],
			describeNodes: { 'obj-1': 42 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.href.href).toBe('https://example.com/page');
	});

	it('falls back to trimmed textContent when the anchor is not represented in the AX tree', async () => {
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: '  Link text  ',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [], // anchor's backendNodeId not present
			describeNodes: { 'obj-1': 99 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Link text');
	});

	it('falls back to textContent when the AX tree response is malformed (no `nodes` field)', async () => {
		// Defensive: an unexpected CDP shape must not throw or pollute the map.
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: 'Plain text',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			getFullAXTree: () => Promise.resolve({}),
			describeNodes: { 'obj-1': 1 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Plain text');
	});

	it('falls back to textContent when DOM.describeNode response is malformed (no `node` field)', async () => {
		// Defensive: an unexpected CDP shape must not throw inside Promise.all.
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: 'Plain text',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 1, name: { value: 'AX Name' } }],
			describeNode: () => Promise.resolve({}),
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Plain text');
	});

	it('falls back to textContent for every anchor when the AX tree fetch rejects', async () => {
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: 'Plain text',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			getFullAXTree: () => Promise.reject(new Error('CDP unavailable')),
			describeNodes: { 'obj-1': 1 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Plain text');
	});

	it('falls back to textContent when DOM.describeNode rejects for an anchor', async () => {
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: 'Plain text',
		});
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 1, name: { value: 'AX Name' } }],
			describeNode: () => Promise.reject(new Error('detached')),
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Plain text');
	});

	it('returns partial results when the overall operation exceeds the timeout', async () => {
		vi.useFakeTimers();
		const $fast = mockAnchorHandle('obj-fast', { href: 'https://example.com/fast' });
		const $slow = {
			remoteObject: () => ({ objectId: 'obj-slow' }),
			getProperty: () => new Promise(() => {}), // never resolves
		} as unknown as ElementHandle<Element>;
		const page = mockPageForAnchors({
			anchors: [$fast, $slow],
			axNodes: [{ backendDOMNodeId: 1, name: { value: 'Fast' } }],
			describeNodes: { 'obj-fast': 1, 'obj-slow': 2 },
		});

		const promise = getAnchorList(page, undefined, 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const anchors = await promise;

		// The fast anchor was collected before the overall race tripped; the slow
		// one was abandoned.
		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.href.href).toBe('https://example.com/fast');
	});

	it('skips non-HTTP links', async () => {
		const $anchor = mockAnchorHandle('obj-1', { href: 'javascript:void(0)' });
		const page = mockPageForAnchors({
			anchors: [$anchor],
			axNodes: [{ backendDOMNodeId: 1, name: { value: 'JS link' } }],
			describeNodes: { 'obj-1': 1 },
		});

		const anchors = await getAnchorList(page);

		expect(anchors).toStrictEqual([]);
	});

	it("falls back to textContent for every anchor when puppeteer's internal CDP session is unavailable", async () => {
		const $anchor = mockAnchorHandle('obj-1', {
			href: 'https://example.com/page',
			textContent: '  Plain text  ',
		});
		// Page mock without `_client()`: simulates puppeteer wrappers that hide the
		// internal session — the function must still produce anchor data, just
		// without AX names.
		const page = {
			$$: () => Promise.resolve([$anchor]),
		} as unknown as Page;

		const anchors = await getAnchorList(page);

		expect(anchors).toHaveLength(1);
		expect(anchors[0]?.textContent).toBe('Plain text');
	});

	it('returns an empty array when the page has no anchors', async () => {
		const page = mockPageForAnchors({ anchors: [] });

		const anchors = await getAnchorList(page);

		expect(anchors).toStrictEqual([]);
	});
});

describe('DEFAULT_DOM_EVALUATION_TIMEOUT', () => {
	it('defaults to 180 seconds', () => {
		expect(DEFAULT_DOM_EVALUATION_TIMEOUT).toBe(180_000);
	});
});

/**
 * Tripwire: `getAnchorList` reads `(page as any)._client()` to reuse puppeteer's
 * internal CDP session. Unit tests mock that method directly, so a silent
 * removal/rename in a future puppeteer release would not be caught by the
 * functional tests — the production path would just fall back to
 * textContent-only mode without anyone noticing.
 *
 * This block inspects the actual installed puppeteer-core source to assert the
 * `_client()` method still exists. If puppeteer drops or renames it, this test
 * fails and forces a maintainer to update `getInternalCDPClient` instead of
 * silently degrading.
 */
describe('puppeteer internal API tripwire', () => {
	it('puppeteer-core CDP Page still defines _client()', () => {
		const require = createRequire(import.meta.url);
		const cdpPagePath = require.resolve('puppeteer-core/lib/cjs/puppeteer/cdp/Page.js');
		const src = readFileSync(cdpPagePath, 'utf8');
		expect(src).toMatch(/_client\s*\(\s*\)\s*\{/);
	});
});
