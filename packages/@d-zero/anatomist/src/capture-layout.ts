import type { RawLayoutNode } from './types.js';
import type { Page } from 'puppeteer';

import {
	MAIN_CONTENT_FALLBACK_SELECTORS,
	MAIN_CONTENT_SELECTORS,
} from '@d-zero/beholder';

import { captureLayoutTree } from './capture-layout-tree.js';

/**
 * Hard recursion cap passed to {@link captureLayoutTree}. Set well above
 * the classify layer's `maxDepth` (default 6, see `should-recurse.ts`)
 * because single-child wrapper chains are collapsed during classification,
 * not during capture — capture has to walk past them to reach the content
 * classification will actually reason about.
 */
const DEFAULT_CAPTURE_MAX_DEPTH = 60;

/**
 * Captures the main-content geometry tree from a Puppeteer page via a
 * single `page.evaluate`. The selector lists are `@d-zero/beholder`'s
 * shared constants, passed as data because `captureLayoutTree` must stay
 * closure-free for serialization.
 * @param page - Puppeteer page whose DOM has finished loading and settled
 *   (e.g. via `beforePageScan`).
 * @param options - Optional main-content selector override and recursion cap.
 * @param options.mainContentSelector
 * @param options.captureMaxDepth
 * @returns The resolved main selector and its captured subtree geometry.
 * @example
 * ```ts
 * const { mainSelector, root } = await captureLayout(page, { mainContentSelector: '#page-body' });
 * ```
 */
export async function captureLayout(
	page: Page,
	options?: { mainContentSelector?: string | null; captureMaxDepth?: number },
): Promise<{ mainSelector: string | null; root: RawLayoutNode | null }> {
	return page.evaluate(
		captureLayoutTree,
		options?.mainContentSelector ?? null,
		MAIN_CONTENT_SELECTORS,
		MAIN_CONTENT_FALLBACK_SELECTORS,
		options?.captureMaxDepth ?? DEFAULT_CAPTURE_MAX_DEPTH,
	);
}
