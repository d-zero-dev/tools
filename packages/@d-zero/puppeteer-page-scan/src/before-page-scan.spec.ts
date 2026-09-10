import type { Page } from 'puppeteer';

import { scrollAllOver } from '@d-zero/puppeteer-scroll';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { beforePageScan } from './before-page-scan.js';
import { NavigationUnsettledError } from './navigation-unsettled-error.js';

vi.mock('@d-zero/puppeteer-scroll', async () => {
	const actual = await vi.importActual<typeof import('@d-zero/puppeteer-scroll')>(
		'@d-zero/puppeteer-scroll',
	);
	return {
		...actual,
		scrollAllOver: vi.fn(() => Promise.resolve()),
	};
});

/**
 *
 * @param scrollHeight
 */
function createMockPage(scrollHeight = 0): Page {
	return {
		url: vi.fn(() => 'about:blank'),
		mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
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
		).resolves.toEqual({ scrolled: true, scrollHeight: 0, settled: 'idle' });
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

		expect(result).toEqual({ scrolled: false, scrollHeight: 2_000_000, settled: 'idle' });
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

		expect(result).toEqual({ scrolled: true, scrollHeight: 500_000, settled: 'idle' });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('maxScrollHeight 未指定のときは scrollHeight にかかわらず scrollAllOver を呼ぶ', async () => {
		const page = createMockPage(99_999_999);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 1024,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 99_999_999, settled: 'idle' });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('scrollHeight が maxScrollHeight と等しいとき（境界）は scroll する', async () => {
		const page = createMockPage(1_000_000);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
			maxScrollHeight: 1_000_000,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 1_000_000, settled: 'idle' });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('maxScrollHeight: 0 を指定すると undefined と区別され、scrollHeight が 0 のときのみ scroll する', async () => {
		const page = createMockPage(0);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
			maxScrollHeight: 0,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 0, settled: 'idle' });
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('page.evaluate が detached Frame で reject しても 3 回までリトライして scroll を続行する', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValueOnce(new Error("Attempted to use detached Frame 'XXX'."))
			.mockResolvedValueOnce(500_000);
		const page = {
			url: vi.fn(() => 'about:blank'),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			evaluate,
		} as unknown as Page;

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
			maxScrollHeight: 1_000_000,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 500_000, settled: 'idle' });
		expect(evaluate).toHaveBeenCalledTimes(2);
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('detached Frame が連続 3 回続くと諦めて呼び出し元にエラーを伝播する', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValue(new Error("Attempted to use detached Frame 'XXX'."));
		const page = {
			url: vi.fn(() => 'about:blank'),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			evaluate,
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				maxScrollHeight: 1_000_000,
			}),
		).rejects.toThrow("Attempted to use detached Frame 'XXX'.");
		expect(evaluate).toHaveBeenCalledTimes(3);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});

	it('detached Frame 以外のエラーは即座に伝播し、リトライされない', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValue(new Error('TypeError: foo is not a function'));
		const page = {
			url: vi.fn(() => 'about:blank'),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload: vi.fn(() => Promise.resolve()),
			evaluate,
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				maxScrollHeight: 1_000_000,
			}),
		).rejects.toThrow('TypeError');
		expect(evaluate).toHaveBeenCalledTimes(1);
	});
});

describe('beforePageScan → networkidle フォールバックと settled', () => {
	beforeEach(() => {
		vi.mocked(scrollAllOver).mockClear();
	});

	it('networkidle0 が即座に成功したとき settled:"idle" を返す', async () => {
		const page = createMockPage(1000);

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 1000, settled: 'idle' });
		expect(page.goto).toHaveBeenCalledTimes(1);
	});

	it('networkidle0 timeout → networkidle2 成功で settled:"idle"、goto は2回呼ばれる', async () => {
		const goto = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockResolvedValueOnce();
		const page = {
			url: vi.fn(() => 'about:blank'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto,
			reload: vi.fn(() => Promise.resolve()),
			evaluate: vi.fn(() => Promise.resolve(1000)),
		} as unknown as Page;

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'test',
			width: 320,
		});

		expect(result).toEqual({ scrolled: true, scrollHeight: 1000, settled: 'idle' });
		expect(goto).toHaveBeenCalledTimes(2);
	});

	it('networkidle0/networkidle2 とも timeout でもフレームが健全なら settled:"degraded" で scroll まで続行する', async () => {
		// page.url() === url なので isReload=true（page.reload() が使われる）
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(new Error('Navigation timeout of 15000 ms exceeded'));
		const evaluate = vi
			.fn()
			.mockResolvedValueOnce(true) // isFrameSettled の readyState/body チェック
			.mockResolvedValueOnce(500_000); // scrollHeight 計測
		const page = {
			url: vi.fn(() => 'https://example.com'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload,
			evaluate,
		} as unknown as Page;

		const result = await beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
			continueOnDegradedNetwork: true,
		});

		expect(result).toEqual({
			scrolled: true,
			scrollHeight: 500_000,
			settled: 'degraded',
		});
		expect(scrollAllOver).toHaveBeenCalledTimes(1);
	});

	it('continueOnDegradedNetwork 未指定（既定 false）のときは、フレームが健全でも2回目の timeout をそのまま伝播する（既存呼び出し元の後方互換）', async () => {
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(new Error('Navigation timeout of 15000 ms exceeded'));
		const page = {
			url: vi.fn(() => 'https://example.com'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload,
			evaluate: vi.fn(() => Promise.resolve(true)),
		} as unknown as Page;

		const promise = beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
		});

		await expect(promise).rejects.toThrow('Navigation timeout of 15000 ms exceeded');
		await expect(promise).rejects.not.toBeInstanceOf(NavigationUnsettledError);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});

	it('判定NG（mainFrame が detached）のとき NavigationUnsettledError を投げ、scroll は行われない', async () => {
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(new Error('Navigation timeout of 15000 ms exceeded'));
		const page = {
			url: vi.fn(() => 'https://example.com'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => true) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload,
			evaluate: vi.fn(() => Promise.resolve(true)),
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				continueOnDegradedNetwork: true,
			}),
		).rejects.toThrow(NavigationUnsettledError);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});

	it('判定NG（page.url() が対象URLと不一致）のとき NavigationUnsettledError を投げる', async () => {
		const goto = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(new Error('Navigation timeout of 15000 ms exceeded'));
		const page = {
			url: vi.fn(() => 'https://elsewhere.example.com/'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto,
			reload: vi.fn(() => Promise.resolve()),
			evaluate: vi.fn(() => Promise.resolve(true)),
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				continueOnDegradedNetwork: true,
			}),
		).rejects.toThrow(NavigationUnsettledError);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});

	it('判定NG（document.readyState が loading 相当）のとき NavigationUnsettledError を投げる', async () => {
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(new Error('Navigation timeout of 15000 ms exceeded'));
		const page = {
			url: vi.fn(() => 'https://example.com'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload,
			evaluate: vi.fn(() => Promise.resolve(false)),
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', {
				name: 'mobile-small',
				width: 320,
				continueOnDegradedNetwork: true,
			}),
		).rejects.toThrow(NavigationUnsettledError);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});

	it('networkidle0 の非timeoutエラー（Protocol error 等）は即座に伝播し、networkidle2 へフォールバックしない', async () => {
		const goto = vi
			.fn()
			.mockRejectedValueOnce(
				new Error('Protocol error (Page.navigate): Not attached to an active page'),
			);
		const page = {
			url: vi.fn(() => 'about:blank'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto,
			reload: vi.fn(() => Promise.resolve()),
			evaluate: vi.fn(() => Promise.resolve(0)),
		} as unknown as Page;

		await expect(
			beforePageScan(page, 'https://example.com', { name: 'mobile-small', width: 320 }),
		).rejects.toThrow('Not attached to an active page');
		expect(goto).toHaveBeenCalledTimes(1);
	});

	it('networkidle2 フォールバック中の非timeoutエラー（Protocol error 等）は NavigationUnsettledError にラップせずそのまま伝播する', async () => {
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('Navigation timeout of 5000 ms exceeded'))
			.mockRejectedValueOnce(
				new Error('Protocol error (Page.reload): Not attached to an active page'),
			);
		const page = {
			url: vi.fn(() => 'https://example.com'),
			mainFrame: vi.fn(() => ({ isDetached: vi.fn(() => false) })),
			setViewport: vi.fn(() => Promise.resolve()),
			goto: vi.fn(() => Promise.resolve()),
			reload,
			evaluate: vi.fn(() => Promise.resolve(true)),
		} as unknown as Page;

		const promise = beforePageScan(page, 'https://example.com', {
			name: 'mobile-small',
			width: 320,
			continueOnDegradedNetwork: true,
		});

		await expect(promise).rejects.toThrow('Not attached to an active page');
		await expect(promise).rejects.not.toBeInstanceOf(NavigationUnsettledError);
		expect(scrollAllOver).not.toHaveBeenCalled();
	});
});
