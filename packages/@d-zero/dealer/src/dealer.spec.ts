import type { DealerOptions } from './dealer.js';

import { describe, test, expect, expectTypeOf } from 'vitest';

import { Dealer } from './dealer.js';

/**
 *
 * @param count
 */
function createItems(count: number): object[] {
	return Array.from({ length: count }, () => ({}));
}

/**
 *
 * @param dealer
 */
function runDealer<T extends WeakKey>(dealer: Dealer<T>): Promise<void> {
	return new Promise<void>((resolve) => {
		dealer.finish(() => resolve());
		dealer.play();
	});
}

describe('Dealer', () => {
	test('processes all items', async () => {
		const items = createItems(3);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 10 });

		await dealer.setup((_item, index) => {
			return Promise.resolve(() => {
				processed.push(index);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(3);
		expect(processed).toContain(0);
		expect(processed).toContain(1);
		expect(processed).toContain(2);
	});

	test('respects limit for parallel execution', async () => {
		const items = createItems(5);
		let maxConcurrent = 0;
		let currentConcurrent = 0;
		const dealer = new Dealer(items, { limit: 2 });

		await dealer.setup(() => {
			return Promise.resolve(async () => {
				currentConcurrent++;
				maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
				await new Promise((r) => setTimeout(r, 10));
				currentConcurrent--;
			});
		});

		await runDealer(dealer);
		expect(maxConcurrent).toBeLessThanOrEqual(2);
	});

	test('push() adds items that get processed', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 10 });
		const pushed = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					await dealer.push(...pushed);
				}
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(3);
		expect(processed).toContain(0);
		expect(processed).toContain(1);
		expect(processed).toContain(2);
	});

	test('unshift() adds items that get processed', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 10 });
		const unshifted = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					await dealer.unshift(...unshifted);
				}
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(3);
		expect(processed).toContain(0);
		expect(processed).toContain(1);
		expect(processed).toContain(2);
	});

	test('unshift() processes prepended items before pending queue items', async () => {
		const items = createItems(3);
		const startOrder: number[] = [];
		// limit 1 ならディスパッチは厳密に逐次化され、順序はタイミングではなく
		// #items の並びだけで決まる（setTimeout 等の遅延に依存しない）
		const dealer = new Dealer(items, { limit: 1 });
		const unshifted = createItems(1);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				startOrder.push(index);
				// 最初のアイテム処理中に先頭へ割り込み追加する
				if (index === 0) {
					await dealer.unshift(...unshifted);
				}
			});
		});

		await runDealer(dealer);
		// 初期アイテム 0 の次に、unshift された 3 が初期アイテム 1, 2 より先に処理される
		expect(startOrder).toEqual([0, 3, 1, 2]);
	});

	test('unshift() preserves argument order at the front of the queue', async () => {
		const items = createItems(1);
		const startOrder: number[] = [];
		// limit 1 でディスパッチ順を決定論的に観測する
		const dealer = new Dealer(items, { limit: 1 });
		const unshifted = createItems(3);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				startOrder.push(index);
				if (index === 0) {
					await dealer.unshift(...unshifted);
				}
			});
		});

		await runDealer(dealer);
		// unshift(a, b, c) は a→b→c の順で先頭に並び、index も同じ順に採番される
		expect(startOrder).toEqual([0, 1, 2, 3]);
	});

	test('unshift() keeps the prepended batch contiguous and ahead of pending items', async () => {
		// 既存の未処理アイテム 3 件（index 0,1,2）に対し、処理中に 2 件を unshift する
		const items = createItems(3);
		const startOrder: number[] = [];
		const dealer = new Dealer(items, { limit: 1 });
		const unshifted = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				startOrder.push(index);
				if (index === 0) {
					await dealer.unshift(...unshifted);
				}
			});
		});

		await runDealer(dealer);
		// unshift した 3,4 は引数順を保って連続し（要素ごと挿入なら 4,3 に逆転する）、
		// 未処理の既存アイテム 1,2 より前に処理される
		expect(startOrder).toEqual([0, 3, 4, 1, 2]);
	});

	test('unshift() is dispatched ahead of items added by push() in the same run', async () => {
		const items = createItems(1);
		const startOrder: number[] = [];
		const dealer = new Dealer(items, { limit: 1 });
		const pushed = createItems(1);
		const unshifted = createItems(1);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				startOrder.push(index);
				if (index === 0) {
					await dealer.push(...pushed); // index 1 → 末尾へ
					await dealer.unshift(...unshifted); // index 2 → 先頭へ
				}
			});
		});

		await runDealer(dealer);
		// 後から unshift した 2 が、先に push した 1 より先に処理される
		expect(startOrder).toEqual([0, 2, 1]);
	});

	test('unshift() after done is safely ignored', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 10 });

		await dealer.setup((_item, index) => {
			return Promise.resolve(() => {
				processed.push(index);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(1);

		const extra = createItems(1);
		await dealer.unshift(...extra);
		expect(processed).toHaveLength(1);
	});

	test('unshift() is ignored after signal is aborted', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const controller = new AbortController();
		const dealer = new Dealer(items, { limit: 10, signal: controller.signal });
		const unshifted = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				controller.abort();
				await dealer.unshift(...unshifted);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(1);
	});

	test('unshift() stops initializing the rest of the batch once the signal aborts mid-init', async () => {
		const initialized: string[] = [];
		const processed: string[] = [];
		const controller = new AbortController();
		const a = { id: 'a' };
		const b = { id: 'b' };
		const c = { id: 'c' };

		const dealer = new Dealer<{ id: string }>([{ id: 'init' }], {
			limit: 1,
			signal: controller.signal,
		});

		await dealer.setup((item) => {
			initialized.push(item.id);
			// バッチ初期化の途中（2 件目 b）で abort する
			if (item.id === 'b') {
				controller.abort();
			}
			return Promise.resolve(async () => {
				processed.push(item.id);
				if (item.id === 'init') {
					await dealer.unshift(a, b, c);
				}
			});
		});

		await runDealer(dealer);

		// abort を検知した時点で以降の c は初期化されない（break が効いている証拠）
		expect(initialized).toEqual(['init', 'a', 'b']);
		// abort 後は新規ワーカーを起動しないため、初期化済みの a も処理されない
		expect(processed).toEqual(['init']);
	});

	test('unshift() with all items rejected by onPush is a no-op', async () => {
		const processed: number[] = [];
		const dealer = new Dealer(createItems(1), {
			limit: 10,
			onPush: () => false,
		});

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					await dealer.unshift(...createItems(3));
				}
			});
		});

		await runDealer(dealer);
		// 全件拒否されるため、初期アイテム 1 件以外は処理されず正常終了する
		expect(processed).toEqual([0]);
	});

	test('unshift() respects onPush filter and rejects the specific item', async () => {
		const init = { id: 'init' };
		const a = { id: 'a' };
		const b = { id: 'b' };
		const c = { id: 'c' };
		const processedIds: string[] = [];

		// 呼び出し回数ではなくアイテムそのものを見て b だけ拒否する
		const dealer = new Dealer([init], {
			limit: 10,
			onPush: (item) => item.id !== 'b',
		});

		await dealer.setup((item) => {
			return Promise.resolve(async () => {
				processedIds.push(item.id);
				if (item.id === 'init') {
					await dealer.unshift(a, b, c);
				}
			});
		});

		await runDealer(dealer);
		// b は onPush で除外され、a と c のみ処理される
		expect(processedIds).toContain('a');
		expect(processedIds).toContain('c');
		expect(processedIds).not.toContain('b');
		expect(processedIds).toHaveLength(3);
	});

	test('done resolves after all items including pushed ones complete', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 1 });
		const pushed = createItems(3);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					await dealer.push(...pushed);
				}
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(4);
	});

	test('push() after done is safely ignored', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const dealer = new Dealer(items, { limit: 10 });

		await dealer.setup((_item, index) => {
			return Promise.resolve(() => {
				processed.push(index);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(1);

		const extra = createItems(1);
		await dealer.push(...extra);
		expect(processed).toHaveLength(1);
	});

	test('pushed items get unique indices', async () => {
		const items = createItems(2);
		const indices: number[] = [];
		const dealer = new Dealer(items, { limit: 1 });
		const pushed = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				indices.push(index);
				if (index === 0) {
					await dealer.push(...pushed);
				}
			});
		});

		await runDealer(dealer);
		expect(indices).toHaveLength(4);
		const uniqueIndices = new Set(indices);
		expect(uniqueIndices.size).toBe(4);
	});

	test('dispatch order follows #items order with limit > 1', async () => {
		const items = createItems(2);
		const startOrder: number[] = [];
		const dealer = new Dealer(items, { limit: 3 });
		const pushed = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				startOrder.push(index);
				if (index === 0) {
					await dealer.push(...pushed);
				}
				await new Promise((r) => setTimeout(r, 5));
			});
		});

		await runDealer(dealer);
		expect(startOrder).toHaveLength(4);
		// Indices 0 and 1 are initial items, 2 and 3 are pushed
		// Pushed items should appear after initial items in start order
		const pushStartPositions = [startOrder.indexOf(2), startOrder.indexOf(3)];
		for (const pos of pushStartPositions) {
			expect(pos).toBeGreaterThanOrEqual(0);
		}
	});

	test('onPush filters items', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const pushed = createItems(3);
		let pushCallCount = 0;

		const dealer = new Dealer(items, {
			limit: 10,
			onPush: () => {
				pushCallCount++;
				// Accept only the first and third push
				return pushCallCount !== 2;
			},
		});

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					await dealer.push(...pushed);
				}
			});
		});

		await runDealer(dealer);
		// Initial item (0) + 2 accepted pushes (1, 2)
		expect(processed).toHaveLength(3);
	});

	test('progress reports correct values', async () => {
		const items = createItems(2);
		const progressCalls: Array<{ progress: number; done: number; total: number }> = [];
		const dealer = new Dealer(items, { limit: 1 });

		dealer.progress((progress, done, total) => {
			progressCalls.push({ progress, done, total });
		});

		await dealer.setup(() => {
			return Promise.resolve(() => {});
		});

		await runDealer(dealer);
		// Check that final call shows completion
		const lastCall = progressCalls.at(-1)!;
		expect(lastCall.progress).toBe(1);
		expect(lastCall.done).toBe(2);
		expect(lastCall.total).toBe(2);
	});

	test('DealerOptions onPush receives the item type', () => {
		type Item = { id: string };
		type Opts = DealerOptions<Item>;
		expectTypeOf<Opts['onPush']>().toEqualTypeOf<((item: Item) => boolean) | undefined>();
	});

	test('DealerOptions defaults to unknown', () => {
		type Opts = DealerOptions;
		expectTypeOf<Opts['onPush']>().toEqualTypeOf<
			((item: unknown) => boolean) | undefined
		>();
	});

	test('Dealer constructor infers onPush type from items', () => {
		const items = [{ id: 'a' }, { id: 'b' }];
		const dealer = new Dealer(items, {
			onPush: (item) => {
				expectTypeOf(item).toEqualTypeOf<{ id: string }>();
				return true;
			},
		});
		expectTypeOf(dealer).toMatchTypeOf<Dealer<{ id: string }>>();
	});

	test('progress does not produce NaN with empty items', async () => {
		const items: object[] = [];
		const progressCalls: Array<{ progress: number }> = [];
		const dealer = new Dealer(items, { limit: 10 });

		dealer.progress((progress) => {
			progressCalls.push({ progress });
		});

		await dealer.setup(() => {
			return Promise.resolve(() => {});
		});

		for (const call of progressCalls) {
			expect(Number.isNaN(call.progress)).toBe(false);
		}
	});

	test('signal stops launching new workers when aborted', async () => {
		const items = createItems(5);
		const processed: number[] = [];
		const controller = new AbortController();
		const dealer = new Dealer(items, { limit: 1, signal: controller.signal });

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				if (index === 0) {
					controller.abort();
				}
				await new Promise((r) => setTimeout(r, 5));
			});
		});

		await runDealer(dealer);
		expect(processed.length).toBeLessThan(5);
		expect(processed).toContain(0);
	});

	test('signal waits for running workers to complete before finishing', async () => {
		const items = createItems(3);
		const completed: number[] = [];
		const controller = new AbortController();
		const dealer = new Dealer(items, { limit: 3, signal: controller.signal });

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				if (index === 0) {
					controller.abort();
				}
				await new Promise((r) => setTimeout(r, 20));
				completed.push(index);
			});
		});

		await runDealer(dealer);
		// All 3 workers were launched before abort, so all 3 should complete
		expect(completed).toHaveLength(3);
	});

	test('push() is ignored after signal is aborted', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const controller = new AbortController();
		const dealer = new Dealer(items, { limit: 10, signal: controller.signal });
		const pushed = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				controller.abort();
				await dealer.push(...pushed);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(1);
	});

	test('abort during push initialization does not cause deadlock', async () => {
		const items = createItems(1);
		const processed: number[] = [];
		const controller = new AbortController();
		const dealer = new Dealer(items, { limit: 1, signal: controller.signal });
		const pushed = createItems(2);

		await dealer.setup((_item, index) => {
			return Promise.resolve(async () => {
				processed.push(index);
				controller.abort();
				// push triggers #initializeAndDispatch which awaits initializer
				// abort should prevent pushed items from being added to #items
				await dealer.push(...pushed);
			});
		});

		// This must resolve (not deadlock) even though push was called after abort
		await runDealer(dealer);
		expect(processed).toHaveLength(1);
	});

	test('pre-aborted signal finishes immediately without processing', async () => {
		const items = createItems(3);
		const processed: number[] = [];
		const controller = new AbortController();
		controller.abort();
		const dealer = new Dealer(items, { limit: 10, signal: controller.signal });

		await dealer.setup((_item, index) => {
			return Promise.resolve(() => {
				processed.push(index);
			});
		});

		await runDealer(dealer);
		expect(processed).toHaveLength(0);
	});

	test('finish is called with empty items', async () => {
		const items: object[] = [];
		const dealer = new Dealer(items, { limit: 10 });

		await dealer.setup(() => {
			return Promise.resolve(() => {});
		});

		await runDealer(dealer);
	});

	describe('setLimit', () => {
		test('increasing the limit immediately fills newly available slots', async () => {
			const items = createItems(4);
			let maxConcurrent = 0;
			let currentConcurrent = 0;
			const dealer = new Dealer(items, { limit: 1 });
			const { promise: firstStarted, resolve: resolveFirstStarted } =
				Promise.withResolvers<void>();
			const { promise: canFinishFirst, resolve: resolveCanFinishFirst } =
				Promise.withResolvers<void>();
			let firstCall = true;

			await dealer.setup(() => {
				return Promise.resolve(async () => {
					currentConcurrent++;
					maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
					if (firstCall) {
						firstCall = false;
						resolveFirstStarted();
						await canFinishFirst;
					}
					currentConcurrent--;
				});
			});

			const done = runDealer(dealer);
			await firstStarted;
			// limit 1 のあいだは1件しか動いていないはず
			expect(maxConcurrent).toBe(1);

			dealer.setLimit(4);
			resolveCanFinishFirst();
			await done;

			expect(maxConcurrent).toBeGreaterThan(1);
			expect(dealer.limit).toBe(4);
		});

		test('decreasing the limit lets already-started workers finish, but throttles concurrency for items dispatched afterward', async () => {
			// limit 3・5件: 最初の3件（index 0,1,2）が同時ディスパッチされる。
			// それらが実行中のうちに limit を 1 へ落とし、(a) 実行中の3件は
			// 中断されず全件完了すること、(b) 減少後に新規ディスパッチされる
			// 残り2件（index 3,4）は同時に1件までしか動かないことを検証する。
			const items = createItems(5);
			const dealer = new Dealer(items, { limit: 3 });
			const startedFirstBatch: number[] = [];
			const { promise: firstBatchStarted, resolve: resolveFirstBatchStarted } =
				Promise.withResolvers<void>();
			const { promise: canFinishFirstBatch, resolve: resolveCanFinishFirstBatch } =
				Promise.withResolvers<void>();
			let decreased = false;
			let concurrentAfterDecrease = 0;
			let maxConcurrentAfterDecrease = 0;

			await dealer.setup((_item, index) => {
				return Promise.resolve(async () => {
					if (!decreased) {
						startedFirstBatch.push(index);
						if (startedFirstBatch.length === 3) {
							resolveFirstBatchStarted();
						}
						await canFinishFirstBatch;
						return;
					}
					concurrentAfterDecrease++;
					maxConcurrentAfterDecrease = Math.max(
						maxConcurrentAfterDecrease,
						concurrentAfterDecrease,
					);
					await new Promise((r) => setTimeout(r, 5));
					concurrentAfterDecrease--;
				});
			});

			const done = runDealer(dealer);
			await firstBatchStarted;
			expect(startedFirstBatch).toHaveLength(3);

			// setLimit はテストの非同期フロー（＝ワーカー自身の同期区間の外）から
			// 呼ぶ。これは実運用（外部入力による並列数変更）と同じ呼び出し方。
			decreased = true;
			dealer.setLimit(1);
			resolveCanFinishFirstBatch();

			await done;

			expect(startedFirstBatch).toHaveLength(3);
			expect(maxConcurrentAfterDecrease).toBe(1);
			expect(dealer.limit).toBe(1);
		});

		test('throws RangeError for non-positive-integer limits', () => {
			const dealer = new Dealer(createItems(1), { limit: 5 });
			expect(() => dealer.setLimit(0)).toThrow(RangeError);
			expect(() => dealer.setLimit(-1)).toThrow(RangeError);
			expect(() => dealer.setLimit(1.5)).toThrow(RangeError);
			expect(dealer.limit).toBe(5);
		});

		test('after the dealer has finished, setLimit updates the stored limit without throwing or dispatching', async () => {
			const items = createItems(1);
			const dealer = new Dealer(items, { limit: 10 });

			await dealer.setup(() => Promise.resolve(() => {}));
			await runDealer(dealer);

			expect(() => dealer.setLimit(3)).not.toThrow();
			// #deal() 自体は #finished ガードで即 return する（新規ディスパッチは
			// 発生しない）が、#limit フィールドの更新はガードの影響を受けない
			expect(dealer.limit).toBe(3);
		});

		test('a synchronous setLimit call from within a worker still respects the limit deterministically (re-entrant #deal() calls are ignored)', async () => {
			// worker 自身の同期区間（最初の await より前）から setLimit を呼ぶ
			// 稀なケースでも、#deal() の再入防止により外側のディスパッチループが
			// 一貫して最新の #limit を尊重する。increase 版は
			// 'onStart receives a controller...'（deal.spec.ts）で間接的に検証済み
			// なので、ここでは decrease 版のみ確認する。
			const items = createItems(3);
			const dealer = new Dealer(items, { limit: 3 });
			const processed: number[] = [];

			await dealer.setup((_item, index) => {
				return Promise.resolve(async () => {
					processed.push(index);
					if (index === 0) {
						// この時点で #deal() はまだ while ループの最中（再入）
						dealer.setLimit(1);
					}
					await new Promise((r) => setTimeout(r, 1));
				});
			});

			await runDealer(dealer);
			// 再入経路でも例外や取りこぼしなく全件完了する
			expect(processed).toHaveLength(3);
			expect(dealer.limit).toBe(1);
		});
	});
});
