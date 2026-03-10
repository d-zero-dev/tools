import { describe, test, expect } from 'vitest';

import { deal } from './deal.js';

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
});
