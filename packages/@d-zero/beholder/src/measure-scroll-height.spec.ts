import type { Page } from 'puppeteer';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { measureScrollHeight } from './measure-scroll-height.js';

describe('measureScrollHeight', () => {
	let page: Page;
	let scrollHeights: number[];

	beforeEach(() => {
		scrollHeights = [2400, 5200];
		let call = 0;
		page = {
			setViewport: vi.fn(() => Promise.resolve()),
			evaluate: vi.fn(() => Promise.resolve(scrollHeights[call++] ?? 0)),
		} as unknown as Page;
	});

	it('returns desktop and mobile heights without scrolling the page', async () => {
		const result = await measureScrollHeight(page);

		expect(result).toEqual({ desktop: 2400, mobile: 5200 });
		expect(page.setViewport).toHaveBeenCalledTimes(2);
		expect(page.setViewport).toHaveBeenNthCalledWith(1, {
			width: 1280,
			height: 800,
			deviceScaleFactor: 1,
		});
		expect(page.setViewport).toHaveBeenNthCalledWith(2, {
			width: 320,
			height: 800,
			deviceScaleFactor: 2,
		});
	});

	it('returns null for a preset that throws', async () => {
		page.setViewport = vi
			.fn()
			.mockResolvedValueOnce()
			.mockRejectedValueOnce(new Error('viewport failed'));

		const result = await measureScrollHeight(page);

		expect(result).toEqual({ desktop: 2400, mobile: null });
	});
});
