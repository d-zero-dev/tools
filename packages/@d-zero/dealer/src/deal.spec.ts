import type { DealController } from './types.js';

import { describe, test, expect, vi } from 'vitest';

import { deal } from './deal.js';
import { Lanes } from './lanes.js';

/**
 *
 * @param count
 */
function createItems(count: number): object[] {
	return Array.from({ length: count }, () => ({}));
}

describe('deal', () => {
	test('signal cancels processing via deal() options', async () => {
		const items = createItems(5);
		const processed: number[] = [];
		const controller = new AbortController();

		await deal(
			items,
			(_process, _update, index) => {
				return async () => {
					processed.push(index);
					if (index === 0) {
						controller.abort();
					}
					await new Promise((r) => setTimeout(r, 5));
				};
			},
			{ limit: 1, signal: controller.signal, verbose: true },
		);

		expect(processed.length).toBeLessThan(5);
		expect(processed).toContain(0);
	});

	test('pre-aborted signal resolves immediately via deal()', async () => {
		const items = createItems(3);
		const processed: number[] = [];
		const controller = new AbortController();
		controller.abort();

		await deal(
			items,
			(_process, _update, index) => {
				return () => {
					processed.push(index);
				};
			},
			{ limit: 10, signal: controller.signal, verbose: true },
		);

		expect(processed).toHaveLength(0);
	});

	test('exposes unshift to the setup callback so items are prepended ahead of pending ones', async () => {
		// index 0, 1, 2 の 3 件。limit 1 なので 1, 2 を未処理のまま残せる
		const items = createItems(3);
		const order: number[] = [];
		const extra = createItems(2); // index 3, 4

		await deal(
			items,
			(_process, _update, index, _setLineHeader, _push, unshift) => {
				return async () => {
					order.push(index);
					if (index === 0) {
						await unshift(...extra);
					}
				};
			},
			{ limit: 1, verbose: true },
		);

		// unshift した 3, 4 が引数順を保って連続し、未処理の既存 1, 2 より先に処理される。
		// 第 6 引数が誤って push（末尾追加）へ配線されていれば [0, 1, 2, 3, 4]、
		// 引数順が逆転すれば [0, 4, 3, 1, 2] となり、いずれも落ちる。
		expect(order).toEqual([0, 3, 4, 1, 2]);
	});

	test('applies the onPush filter to items added via the setup callback unshift', async () => {
		const init = { id: 'init' };
		const a = { id: 'a' };
		const b = { id: 'b' };
		const processedIds: string[] = [];

		await deal<{ id: string }>(
			[init],
			(item, _update, _index, _setLineHeader, _push, unshift) => {
				return async () => {
					processedIds.push(item.id);
					if (item.id === 'init') {
						await unshift(a, b);
					}
				};
			},
			{ limit: 1, verbose: true, onPush: (item) => item.id !== 'b' },
		);

		// onPush で b は拒否され、a のみがキューに入って処理される
		expect(processedIds).toContain('a');
		expect(processedIds).not.toContain('b');
		expect(processedIds).toHaveLength(2);
	});

	test('keeps unshift ordering when an interval delay is configured', async () => {
		const items = createItems(2);
		const order: number[] = [];
		const extra = createItems(1); // index 2

		await deal(
			items,
			(_process, _update, index, _setLineHeader, _push, unshift) => {
				return async () => {
					order.push(index);
					if (index === 0) {
						await unshift(...extra);
					}
				};
			},
			{ limit: 1, verbose: true, interval: 1 },
		);

		// interval 待機を挟んでも先頭割り込みの順序は維持される
		expect(order).toEqual([0, 2, 1]);
	});

	test('setup callback throwing still releases lanes (no leaked SIGINT/resize listeners)', async () => {
		// verbose: false（デフォルト）でないと Display は SIGINT ハンドラを登録しないため、
		// このテストは非 verbose モードで実行し、`using lanes` が例外時にも
		// 解放されることを直接観測する
		const stdoutWriteSpy = vi
			.spyOn(process.stdout, 'write')
			.mockImplementation(() => true);
		const resizeBefore = process.stdout.listenerCount('resize');
		const sigintBefore = process.listenerCount('SIGINT');

		const items = createItems(1);

		await expect(
			deal(
				items,
				() => {
					throw new Error('boom');
				},
				{ limit: 1 },
			),
		).rejects.toThrow('boom');

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
		expect(process.listenerCount('SIGINT')).toBe(sigintBefore);

		stdoutWriteSpy.mockRestore();
	});

	test('reuses an injected Lanes instead of creating its own, and does not dispose it', async () => {
		const resizeBefore = process.stdout.listenerCount('resize');
		const lanes = new Lanes({ verbose: true });
		// injected の場合、deal() が独自の Lanes を作らないので resize リスナーは増えない
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);

		await deal(
			createItems(2),
			(_process, update, index) => {
				return () => {
					update(`item ${index}`);
				};
			},
			{ limit: 10, lanes },
		);

		// deal() 完了後も呼び出し元の Lanes は破棄されず生きている
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);
		lanes[Symbol.dispose]();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('onStart receives a controller before play(), and setLimit affects the header limit', async () => {
		const limits: number[] = [];
		let controller: DealController | undefined;
		const { promise: firstStarted, resolve: resolveFirstStarted } =
			Promise.withResolvers<void>();
		const { promise: canFinishFirst, resolve: resolveCanFinishFirst } =
			Promise.withResolvers<void>();
		let firstCall = true;

		const run = deal(
			createItems(3),
			() => {
				return async () => {
					if (firstCall) {
						firstCall = false;
						resolveFirstStarted();
						await canFinishFirst;
					}
				};
			},
			{
				limit: 1,
				verbose: true,
				onStart: (c) => {
					controller = c;
				},
				header: (_progress, _done, _total, limit) => {
					limits.push(limit);
					return `limit: ${limit}`;
				},
			},
		);

		await firstStarted;
		expect(controller).toBeDefined();
		expect(controller?.limit).toBe(1);

		controller?.setLimit(3);
		expect(controller?.limit).toBe(3);
		resolveCanFinishFirst();

		await run;

		expect(limits).toContain(3);
	});
});
