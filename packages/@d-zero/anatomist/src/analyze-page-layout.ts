import type { ClassifyLayoutTreeOptions } from './classify-layout-tree.js';
import type { LayoutAnalysisResult, ViewportSpec } from './types.js';
import type { Page } from 'puppeteer';

import { beforePageScan } from '@d-zero/puppeteer-page-scan';

import { captureLayout } from './capture-layout.js';
import { classifyLayoutTree } from './classify-layout-tree.js';
import { DEFAULT_VIEWPORTS } from './default-viewports.js';

export type AnalyzePageLayoutOptions = {
	/** Viewports to analyze, in the order they're applied. Default: `DEFAULT_VIEWPORTS` (PC → tablet → mobile). */
	viewports?: readonly ViewportSpec[];
	/** Explicit main-content selector; skips the priority-list/fallback search when it matches. */
	mainContentSelector?: string | null;
	/** Navigation timeout (ms) passed to `beforePageScan`. */
	timeout?: number;
	/** Scroll-height guard passed to `beforePageScan` — pages taller than this skip the full-page scroll (see `beforePageScan`'s JSDoc). */
	maxScrollHeight?: number;
} & ClassifyLayoutTreeOptions;

/**
 * Analyzes one URL's main-content layout at each of several viewports,
 * reusing a single `page` across them (see `default-viewports.ts` for why
 * the default order is largest-to-smallest).
 *
 * `beforePageScan` is called with `openDisclosures: true` for every
 * viewport: without forcing `<details>`/`aria-expanded` disclosures open,
 * their contents stay unrendered (zero-size boxes), making the layout
 * inside them unclassifiable. This trades fidelity to the page's default
 * collapsed state for the ability to see accordion/tab-panel layouts at
 * all.
 * @param page - A Puppeteer page, not yet navigated to `url` (or already
 *   there — `beforePageScan` detects and reloads instead of re-opening).
 * @param url - The URL to analyze.
 * @param options
 * @returns One result per viewport, in the order `options.viewports` (or
 *   the default) lists them.
 * @example
 * ```ts
 * const results = await analyzePageLayout(page, 'https://example.com/');
 * for (const { viewport, root } of results) {
 *   console.log(viewport.name, root?.layoutType);
 * }
 * ```
 */
export async function analyzePageLayout(
	page: Page,
	url: string,
	options: AnalyzePageLayoutOptions = {},
): Promise<LayoutAnalysisResult[]> {
	const viewports = options.viewports ?? DEFAULT_VIEWPORTS;
	const results: LayoutAnalysisResult[] = [];

	for (const viewport of viewports) {
		await beforePageScan(page, url, {
			name: viewport.name,
			width: viewport.width,
			openDisclosures: true,
			timeout: options.timeout,
			maxScrollHeight: options.maxScrollHeight,
		});

		const { mainSelector, root } = await captureLayout(page, {
			mainContentSelector: options.mainContentSelector,
		});

		results.push({
			url,
			viewport,
			mainSelector,
			root: root
				? classifyLayoutTree(root, {
						maxDepth: options.maxDepth,
						minArea: options.minArea,
					})
				: null,
		});
	}

	return results;
}
