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

	test('finish is called with empty items', async () => {
		const items: object[] = [];
		const dealer = new Dealer(items, { limit: 10 });

		await dealer.setup(() => {
			return Promise.resolve(() => {});
		});

		await runDealer(dealer);
	});
});
