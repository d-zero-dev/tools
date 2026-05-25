import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beforePageScan } from './before-page-scan.js';

vi.mock('@d-zero/puppeteer-scroll', () => ({
	scrollAllOver: vi.fn(() => Promise.resolve()),
}));

/**
 *
 */
function createMockPage(): Page {
	return {
		url: vi.fn(() => 'about:blank'),
		setViewport: vi.fn(() => Promise.resolve()),
		goto: vi.fn(() => Promise.resolve()),
		reload: vi.fn(() => Promise.resolve()),
		evaluate: vi.fn(() => Promise.resolve()),
	} as unknown as Page;
}

describe('beforePageScan → scrollAllOver の引数伝搬', () => {
	beforeEach(() => {
		vi.mocked(scrollAllOver).mockClear();
	});

	it('scrollInterval / scrollDistance を scrollAllOver に interval/distance として渡す', async () => {
		const page = createMockPage();

		await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 1024,
			scrollInterval: { random: { min: 200, max: 500 } },
			scrollDistance: 150,
		});

		expect(scrollAllOver).toHaveBeenCalledTimes(1);
		expect(scrollAllOver).toHaveBeenCalledWith(
			page,
			expect.objectContaining({
				interval: { random: { min: 200, max: 500 } },
				distance: 150,
			}),
		);
	});

	it('scroll オプション未指定時は interval/distance が undefined で渡る（=scrollAllOver のデフォルト適用）', async () => {
		const page = createMockPage();

		await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 1024,
		});

		expect(scrollAllOver).toHaveBeenCalledTimes(1);
		const callArgs = vi.mocked(scrollAllOver).mock.calls[0]?.[1];
		expect(callArgs?.interval).toBeUndefined();
		expect(callArgs?.distance).toBeUndefined();
	});

	it('数値の scrollInterval / scrollDistance も同じプロパティ名で渡る', async () => {
		const page = createMockPage();

		await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 1024,
			scrollInterval: 350,
			scrollDistance: 600,
		});

		expect(scrollAllOver).toHaveBeenCalledWith(
			page,
			expect.objectContaining({ interval: 350, distance: 600 }),
		);
	});
});
