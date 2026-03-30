import type { Page } from 'puppeteer';

import { describe, expect, it, vi } from 'vitest';

import { scrollAllOver } from './scroll-all-over.js';

/**
 * Creates a mock Puppeteer Page that simulates scrolling behavior.
 *
 * Each call to the `evaluate` callback returns the next entry from `steps`.
 * The first `evaluate` call reads `body.scrollHeight` (returns `scrollHeight`).
 * Subsequent calls simulate `scrollBy` + position reading.
 * @param scrollHeight - The initial `body.scrollHeight` value.
 * @param steps - Sequence of `[currentScrollY, scrollHeight]` pairs returned
 *   by successive `evaluate` calls inside the scroll loop.
 * @returns A minimal Page stub accepted by {@link scrollAllOver}.
 */
function createMockPage(
	scrollHeight: number,
	steps: readonly (readonly [number, number])[],
): Page {
	let callIndex = 0;
	return {
		evaluate: vi.fn(() => {
			if (callIndex === 0) {
				callIndex++;
				return scrollHeight;
			}
			const step = steps[callIndex - 1];
			callIndex++;
			return step ?? [scrollHeight, scrollHeight];
		}),
	} as unknown as Page;
}

describe('scrollAllOver', () => {
	it('正常にスクロールが進行しループが完了する', async () => {
		const page = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);
		const logger = vi.fn();

		await scrollAllOver(page, { interval: 0, logger });

		expect(logger).toHaveBeenCalledWith(200, 300, 'Scrolling');
		expect(logger).toHaveBeenCalledWith(300, 300, 'Scrolling');
		expect(logger).toHaveBeenCalledWith(300, 300, 'End of page');
		expect(logger).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			'Scroll stuck, bailing out',
		);
	});

	it('scrollYが変化しない場合3回後に脱出する', async () => {
		const page = createMockPage(6720, [
			[960, 6720],
			[960, 6720],
			[960, 6720],
			[960, 6720],
		]);
		const logger = vi.fn();

		await scrollAllOver(page, { interval: 0, logger });

		const stuckCall = logger.mock.calls.find(
			(args: unknown[]) => args[2] === 'Scroll stuck, bailing out',
		);
		expect(stuckCall).toBeDefined();
		expect(stuckCall![0]).toBe(960);
		expect(stuckCall![1]).toBe(6720);

		// 4回の Scrolling ログ（初回 + スタック3回）の後に bail out
		const scrollingCalls = logger.mock.calls.filter(
			(args: unknown[]) => args[2] === 'Scrolling',
		);
		expect(scrollingCalls).toHaveLength(4);
	});

	it('一時的にスタックしても再び進行すればカウントがリセットされる', async () => {
		const page = createMockPage(500, [
			[200, 500],
			[200, 500], // stuck 1
			[200, 500], // stuck 2
			[300, 500], // 進行 → リセット
			[400, 500],
			[500, 500],
		]);
		const logger = vi.fn();

		await scrollAllOver(page, { interval: 0, logger });

		expect(logger).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			'Scroll stuck, bailing out',
		);
		expect(logger).toHaveBeenCalledWith(500, 500, 'End of page');
	});
});
