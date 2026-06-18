import type { Page } from 'puppeteer';

import { delay } from '@d-zero/shared/delay';
import { describe, expect, it, vi } from 'vitest';

import { scrollAllOver } from './scroll-all-over.js';

vi.mock('@d-zero/shared/delay', () => ({
	delay: vi.fn(() => Promise.resolve()),
}));

type EvaluateCall = { readonly args: readonly unknown[] };

/**
 * Creates a mock Puppeteer Page that simulates scrolling behavior and
 * records the arguments passed into every `evaluate` call.
 *
 * Each call to the `evaluate` callback returns the next entry from `steps`.
 * The first `evaluate` call reads `body.scrollHeight` (returns `scrollHeight`).
 * Subsequent calls simulate `scrollBy` + position reading.
 * @param scrollHeight - The initial `body.scrollHeight` value.
 * @param steps - Sequence of `[currentScrollY, scrollHeight]` pairs returned
 *   by successive `evaluate` calls inside the scroll loop.
 * @returns A `{ page, evaluateCalls }` pair.
 */
function createMockPage(
	scrollHeight: number,
	steps: readonly (readonly [number, number])[],
): { readonly page: Page; readonly evaluateCalls: readonly EvaluateCall[] } {
	const evaluateCalls: EvaluateCall[] = [];
	let callIndex = 0;
	const page = {
		evaluate: vi.fn((_fn: unknown, ...args: readonly unknown[]) => {
			evaluateCalls.push({ args });
			if (callIndex === 0) {
				callIndex++;
				return scrollHeight;
			}
			const step = steps[callIndex - 1];
			callIndex++;
			return step ?? [scrollHeight, scrollHeight];
		}),
	} as unknown as Page;
	return { page, evaluateCalls };
}

describe('scrollAllOver', () => {
	it('正常にスクロールが進行しループが完了する', async () => {
		const { page } = createMockPage(300, [
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
		const { page } = createMockPage(6720, [
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

		const scrollingCalls = logger.mock.calls.filter(
			(args: unknown[]) => args[2] === 'Scrolling',
		);
		expect(scrollingCalls).toHaveLength(4);
	});

	it('一時的にスタックしても再び進行すればカウントがリセットされる', async () => {
		const { page } = createMockPage(500, [
			[200, 500],
			[200, 500],
			[200, 500],
			[300, 500],
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

	it('interval 未指定時はデフォルトの 200-500ms ランダム範囲で delay が呼ばれる', async () => {
		vi.mocked(delay).mockClear();
		const { page } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page);

		const loopDelayCalls = vi
			.mocked(delay)
			.mock.calls.filter(
				(call) => typeof call[0] === 'object' && call[0] !== null && 'random' in call[0],
			);
		expect(loopDelayCalls.length).toBeGreaterThan(0);
		expect(loopDelayCalls[0]?.[0]).toEqual({
			random: { min: 200, max: 500 },
		});
	});

	it('interval を数値で渡すとその数値が delay にそのまま渡される', async () => {
		vi.mocked(delay).mockClear();
		const { page } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page, { interval: 0 });

		const loopDelayCall = vi.mocked(delay).mock.calls.find((call) => call[0] === 0);
		expect(loopDelayCall).toBeDefined();
	});

	it('distance 未指定時、evaluate の第1引数は null、第2/3引数は 0.5 / 1', async () => {
		const { page, evaluateCalls } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page, { interval: 0 });

		// evaluateCalls[0] is the initial scrollHeight read (no extra args).
		// evaluateCalls[1] is the first in-loop scroll step.
		const firstStep = evaluateCalls[1];
		expect(firstStep?.args[0]).toBeNull();
		expect(firstStep?.args[1]).toBe(0.5);
		expect(firstStep?.args[2]).toBe(1);
	});

	it('distance: 250 を渡すと evaluate の第1引数に 250 が渡される', async () => {
		const { page, evaluateCalls } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page, { interval: 0, distance: 250 });

		const firstStep = evaluateCalls[1];
		const secondStep = evaluateCalls[2];
		expect(firstStep?.args[0]).toBe(250);
		expect(secondStep?.args[0]).toBe(250);
	});

	it('distance: { random } 指定時、毎ループ resolveValue 結果が evaluate に渡る', async () => {
		const { page, evaluateCalls } = createMockPage(900, [
			[300, 900],
			[600, 900],
			[900, 900],
		]);

		await scrollAllOver(page, {
			interval: 0,
			distance: { random: { min: 100, max: 200 } },
		});

		const stepArgs = evaluateCalls.slice(1, 4).map((c) => c.args[0]);
		for (const arg of stepArgs) {
			expect(typeof arg).toBe('number');
			expect(arg).toBeGreaterThanOrEqual(100);
			expect(arg).toBeLessThan(200);
		}
	});

	it('distance: 0 を渡しても最低 1px にガードされる', async () => {
		const { page, evaluateCalls } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page, { interval: 0, distance: 0 });

		expect(evaluateCalls[1]?.args[0]).toBe(1);
	});

	it('distance: -100 を渡しても最低 1px にガードされる', async () => {
		const { page, evaluateCalls } = createMockPage(300, [
			[200, 300],
			[300, 300],
		]);

		await scrollAllOver(page, { interval: 0, distance: -100 });

		expect(evaluateCalls[1]?.args[0]).toBe(1);
	});

	it('page.evaluate が detached Frame で reject したら短い遅延後にリトライして進行する', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValueOnce(new Error("Attempted to use detached Frame 'X'."))
			.mockResolvedValueOnce(300)
			.mockResolvedValueOnce([200, 300])
			.mockResolvedValueOnce([300, 300])
			.mockResolvedValue();
		const page = { evaluate } as unknown as Page;
		const logger = vi.fn();

		await scrollAllOver(page, { interval: 0, logger });

		expect(evaluate).toHaveBeenCalled();
		expect(logger).toHaveBeenCalledWith(300, 300, 'End of page');
	});

	it('page.evaluate が Session closed で reject してもリトライで吸収される', async () => {
		const evaluate = vi
			.fn()
			.mockResolvedValueOnce(300)
			.mockRejectedValueOnce(
				new Error('Protocol error (Runtime.callFunctionOn): Session closed.'),
			)
			.mockResolvedValueOnce([200, 300])
			.mockResolvedValueOnce([300, 300])
			.mockResolvedValue();
		const page = { evaluate } as unknown as Page;
		const logger = vi.fn();

		await scrollAllOver(page, { interval: 0, logger });

		expect(logger).toHaveBeenCalledWith(300, 300, 'End of page');
	});

	it('detached Frame が連続 3 回続くと諦めて呼び出し元にエラーを伝播する', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValue(new Error("Attempted to use detached Frame 'X'."));
		const page = { evaluate } as unknown as Page;

		await expect(scrollAllOver(page, { interval: 0 })).rejects.toThrow(
			"Attempted to use detached Frame 'X'.",
		);
	});

	it('detached Frame 以外のエラーは即座に伝播し、リトライされない', async () => {
		const evaluate = vi
			.fn()
			.mockRejectedValue(new Error('TypeError: foo is not a function'));
		const page = { evaluate } as unknown as Page;

		await expect(scrollAllOver(page, { interval: 0 })).rejects.toThrow('TypeError');
		expect(evaluate).toHaveBeenCalledTimes(1);
	});
});
