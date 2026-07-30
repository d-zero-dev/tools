import type { Page } from 'puppeteer';

import { beforePageScan } from '@d-zero/puppeteer-page-scan';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzePageLayout } from './analyze-page-layout.js';
import { captureLayout } from './capture-layout.js';

vi.mock('@d-zero/puppeteer-page-scan', () => ({
	beforePageScan: vi.fn().mockResolvedValue({ scrolled: true, scrollHeight: 1000 }),
}));

vi.mock('./capture-layout.js', () => ({
	captureLayout: vi.fn(),
}));

const PAGE = {} as unknown as Page;
const URL = 'https://example.com/';

describe('analyzePageLayout', () => {
	beforeEach(() => {
		vi.mocked(captureLayout)
			.mockReset()
			.mockResolvedValue({ mainSelector: null, root: null });
		vi.mocked(beforePageScan).mockClear();
	});

	it('scans every default viewport, largest to smallest, with disclosures forced open', async () => {
		await analyzePageLayout(PAGE, URL);

		expect(beforePageScan).toHaveBeenCalledTimes(3);
		expect(beforePageScan).toHaveBeenNthCalledWith(
			1,
			PAGE,
			URL,
			expect.objectContaining({ name: 'pc', width: 1280, openDisclosures: true }),
		);
		expect(beforePageScan).toHaveBeenNthCalledWith(
			2,
			PAGE,
			URL,
			expect.objectContaining({ name: 'tablet', width: 768, openDisclosures: true }),
		);
		expect(beforePageScan).toHaveBeenNthCalledWith(
			3,
			PAGE,
			URL,
			expect.objectContaining({ name: 'sp', width: 375, openDisclosures: true }),
		);
	});

	it('respects an explicit viewport list instead of the default', async () => {
		const results = await analyzePageLayout(PAGE, URL, {
			viewports: [{ name: 'custom', width: 999 }],
		});

		expect(beforePageScan).toHaveBeenCalledTimes(1);
		expect(results).toHaveLength(1);
		expect(results[0]?.viewport).toEqual({ name: 'custom', width: 999 });
	});

	it('returns a null root when no main element resolves', async () => {
		const results = await analyzePageLayout(PAGE, URL, {
			viewports: [{ name: 'pc', width: 1280 }],
		});

		expect(results).toEqual([
			{ url: URL, viewport: { name: 'pc', width: 1280 }, mainSelector: null, root: null },
		]);
	});

	it('classifies the captured raw tree when main resolves', async () => {
		vi.mocked(captureLayout).mockResolvedValue({
			mainSelector: 'main',
			root: {
				tagName: 'MAIN',
				id: null,
				classList: [],
				boundingBox: { x: 0, y: 0, width: 100, height: 100 },
				style: {
					display: 'block',
					float: 'none',
					position: 'static',
					visibility: 'visible',
				},
				innerHTML: '',
				children: [],
			},
		});

		const results = await analyzePageLayout(PAGE, URL, {
			viewports: [{ name: 'pc', width: 1280 }],
		});

		expect(results[0]?.mainSelector).toBe('main');
		expect(results[0]?.root?.layoutType).toBe('leaf');
	});

	it('forwards mainContentSelector to captureLayout', async () => {
		await analyzePageLayout(PAGE, URL, {
			viewports: [{ name: 'pc', width: 1280 }],
			mainContentSelector: '#x',
		});

		expect(captureLayout).toHaveBeenCalledWith(PAGE, { mainContentSelector: '#x' });
	});
});
