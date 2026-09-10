import type { Page } from 'puppeteer';

import { describe, expect, it, vi } from 'vitest';

import { isFrameSettled } from './is-frame-settled.js';

/**
 *
 * @param overrides - Fields to override on the mock `Page`.
 * @param overrides.isDetached - Value returned by `mainFrame().isDetached()`.
 * @param overrides.url - Value returned by `page.url()`.
 * @param overrides.evaluate - Mock for `page.evaluate` (readyState/body check).
 */
function createMockPage(overrides: {
	isDetached?: boolean;
	url?: string;
	evaluate?: () => Promise<boolean>;
}): Page {
	return {
		mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => overrides.isDetached ?? false) })),
		url: vi.fn(() => overrides.url ?? 'https://example.com'),
		evaluate: overrides.evaluate ?? vi.fn(() => Promise.resolve(true)),
	} as unknown as Page;
}

describe('isFrameSettled', () => {
	it('isDetached=false かつ url一致かつ readyState 到達なら true', async () => {
		const page = createMockPage({ isDetached: false, url: 'https://example.com' });

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(true);
	});

	it('mainFrame が detached のとき false（evaluate は呼ばれない）', async () => {
		const evaluate = vi.fn(() => Promise.resolve(true));
		const page = createMockPage({ isDetached: true, evaluate });

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(false);
		expect(evaluate).not.toHaveBeenCalled();
	});

	it('page.url() が対象URLと不一致のとき false（evaluate は呼ばれない）', async () => {
		const evaluate = vi.fn(() => Promise.resolve(true));
		const page = createMockPage({ url: 'https://elsewhere.example.com/', evaluate });

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(false);
		expect(evaluate).not.toHaveBeenCalled();
	});

	it('ルートページの末尾スラッシュ差異（page.url() が / 付き、対象URLが / なし）は一致とみなす', async () => {
		const page = createMockPage({ url: 'https://example.com/' });

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(true);
	});

	it('サブパスの末尾スラッシュ差異も一致とみなす', async () => {
		const page = createMockPage({ url: 'https://example.com/about/' });

		await expect(isFrameSettled(page, 'https://example.com/about')).resolves.toBe(true);
	});

	it('パス自体が異なるサブパスは不一致のまま', async () => {
		const evaluate = vi.fn(() => Promise.resolve(true));
		const page = createMockPage({ url: 'https://example.com/other', evaluate });

		await expect(isFrameSettled(page, 'https://example.com/about')).resolves.toBe(false);
		expect(evaluate).not.toHaveBeenCalled();
	});

	it('document.readyState が loading 相当（evaluate が false を返す）のとき false', async () => {
		const page = createMockPage({ evaluate: vi.fn(() => Promise.resolve(false)) });

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(false);
	});

	it('evaluate が例外を投げても false に丸める', async () => {
		const page = createMockPage({
			evaluate: vi.fn(() => Promise.reject(new Error('boom'))),
		});

		await expect(isFrameSettled(page, 'https://example.com')).resolves.toBe(false);
	});
});
