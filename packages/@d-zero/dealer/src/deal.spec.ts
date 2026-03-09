import { describe, test, expect } from 'vitest';

import { deal } from './deal.js';

describe('deal', () => {
	test('resolves when all workers succeed', async () => {
		const items = [{}, {}, {}];
		const processed: number[] = [];

		await deal(
			items,
			(_process, _update, index) => {
				return () => {
					processed.push(index);
				};
			},
			{ verbose: true },
		);

		expect(processed).toHaveLength(3);
	});

	test('rejects with AggregateError when a worker fails', async () => {
		const items = [{}, {}, {}];

		const promise = deal(
			items,
			(_process, _update, index) => {
				return () => {
					if (index === 1) {
						throw new Error('worker 1 failed');
					}
				};
			},
			{ verbose: true },
		);

		await expect(promise).rejects.toThrow(AggregateError);
		const error = await promise.catch((error_: unknown) => error_);
		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toHaveLength(1);
		expect((error as AggregateError).errors[0]).toBeInstanceOf(Error);
		expect(((error as AggregateError).errors[0] as Error).message).toBe(
			'worker 1 failed',
		);
		expect((error as AggregateError).message).toBe('1 worker(s) failed');
	});

	test('rejects with AggregateError containing all errors when multiple workers fail', async () => {
		const items = [{}, {}, {}, {}];

		const error = await deal(
			items,
			(_process, _update, index) => {
				return () => {
					if (index % 2 === 0) {
						throw new Error(`worker ${index} failed`);
					}
				};
			},
			{ verbose: true },
		).catch((error_: unknown) => error_);

		expect(error).toBeInstanceOf(AggregateError);
		expect((error as AggregateError).errors).toHaveLength(2);
		expect((error as AggregateError).message).toBe('2 worker(s) failed');
	});

	test('processes all items even when some fail', async () => {
		const items = [{}, {}, {}];
		const processed: number[] = [];

		await deal(
			items,
			(_process, _update, index) => {
				return () => {
					if (index === 0) {
						throw new Error('fail');
					}
					processed.push(index);
				};
			},
			{ verbose: true },
		).catch(() => {});

		expect(processed).toHaveLength(2);
		expect(processed).toContain(1);
		expect(processed).toContain(2);
	});
});
