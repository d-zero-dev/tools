import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beforePageScan } from './before-page-scan.js';

vi.mock('@d-zero/puppeteer-scroll', () => ({
	scrollAllOver: vi.fn(() => Promise.resolve()),
}));

/**
 *
 * @param scrollHeight
 */
function createMockPage(scrollHeight = 0): Page {
	return {
		url: vi.fn(() => 'about:blank'),
		setViewport: vi.fn(() => Promise.resolve()),
		goto: vi.fn(() => Promise.resolve()),
		reload: vi.fn(() => Promise.resolve()),
		evaluate: vi.fn(() => Promise.resolve(scrollHeight)),
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

describe('beforePageScan → hooks の呼び出し', () => {
	beforeEach(() => {
		vi.mocked(scrollAllOver).mockClear();
	});

	it('hooks の各関数が page と {name, width, resolution, log} で配列順に呼ばれる', async () => {
		const page = createMockPage();
		const calls: string[] = [];
		const hook1 = vi.fn(() => {
			calls.push('1');
			return Promise.resolve();
		});
		const hook2 = vi.fn(() => {
			calls.push('2');
			return Promise.resolve();
		});

		await beforePageScan(page, 'https://example.com', {
			name: 'desktop',
			width: 1024,
			resolution: 2,
			hooks: [hook1, hook2],
		});

		expect(calls).toEqual(['1', '2']);
		expect(hook1).toHaveBeenCalledWith(
			page,
			expect.objectContaining({
				name: 'desktop',
				width: 1024,
				resolution: 2,
				log: expect.any(Function),
			}),
		);
		expect(hook2).toHaveBeenCalledWith(
			page,
			expect.objectContaining({
				name: 'desktop',
				width: 1024,
				resolution: 2,
			}),
		);
	});

	it('hooks 未指定でも例外なく完了する', async () => {
		const page = createMockPage();

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'test',
				width: 1024,
			}),
		).resolves.toEqual({ scrolled: true, scrollHeight: 0 });
	});

	it('hooks の途中で throw した場合、後続の hook は呼ばれず例外が伝搬する', async () => {
		const page = createMockPage();
		const hook1 = vi.fn(() => Promise.reject(new Error('hook1 failed')));
		const hook2 = vi.fn(() => Promise.resolve());

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'test',
				width: 1024,
				hooks: [hook1, hook2],
			}),
		).rejects.toThrow('hook1 failed');

		expect(hook1).toHaveBeenCalledTimes(1);
		expect(hook2).not.toHaveBeenCalled();
	});

	it('hooks の log を呼ぶと listener("hook", ...) に転送される', async () => {
		const page = createMockPage();
		const listener = vi.fn();
		const hook = vi.fn((_page, ctx) => {
			ctx.log('hello from hook');
			return Promise.resolve();
		});

		await beforePageScan(page, 'https://example.com', {
			name: 'desktop',
			width: 1024,
			hooks: [hook],
			listener,
		});

		expect(listener).toHaveBeenCalledWith('hook', {
			name: 'desktop',
			message: 'hello from hook',
		});
	});
});

describe('beforePageScan → maxScrollHeight ガード', () => {
	beforeEach(() => {
		vi.mocked(scrollAllOver).mockClear();
	});

	it('scrollHeight が maxScrollHeight を超えるとき scrollAllOver を呼ばず scrolled:false を返す', async () => {
		const page = createMockPage(2_000_000);
		const listener = vi.fn();

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
			maxScrollHeight: 1_000_000,
			listener,
		});

		expect(result).toEqual({ scrolled: false, scrollHeight: 2_000_000 });
		expect(scrollAllOver).not.toHaveBeenCalled();
		expect(listener).toHaveBeenCalledWith('hook', {
			name: 'mobile-small',
			message: 'Skipped scroll: scrollHeight 2000000 exceeds limit 1000000',
		});
	});

	it('scrollHeight が maxScrollHeight 以下のとき scrollAllOver を呼んで scrolled:true を返す', async () => {
		const page = createMockPage(500_000);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
			maxScrollHeight: 1_000_000,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 500_000 });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('maxScrollHeight 未指定のときは scrollHeight にかかわらず scrollAllOver を呼ぶ', async () => {
		const page = createMockPage(99_999_999);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 1024,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 99_999_999 });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('scrollHeight が maxScrollHeight と等しいとき（境界）は scroll する', async () => {
		const page = createMockPage(1_000_000);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
			maxScrollHeight: 1_000_000,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 1_000_000 });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('maxScrollHeight: 0 を指定すると undefined と区別され、scrollHeight が 0 のときのみ scroll する', async () => {
		const page = createMockPage(0);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
			maxScrollHeight: 0,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 0 });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('page.evaluate が reject した場合 beforePageScan も reject し、scrollAllOver は呼ばれない', async () => {
		const page = {
			url: vi.fn(() => 'about:blank'),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			evaluate: vi.fn(() =>
				Promise.reject(new Error("Attempted to use detached Frame 'XXX'.")),
			),
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				maxScrollHeight: 1_000_000,
			}),
		).rejects.toThrow("Attempted to use detached Frame 'XXX'.");
		expect(scrollAllOver).not.toHaveBeenCalled();
	});
});
