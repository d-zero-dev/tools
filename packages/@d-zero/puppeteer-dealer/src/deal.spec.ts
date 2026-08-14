import type { ChildProcessManager } from './create-main-process.js';
import type { URLInfo } from './types.js';

import { deal as coreDeal } from '@d-zero/dealer';
import { describe, test, expect, vi } from 'vitest';

import { deal } from './deal.js';

vi.mock('@d-zero/dealer', () => ({
	deal: vi.fn(),
}));

/**
 * `createProcess()(needAuth)` が返す {@link ChildProcessManager} の代役。
 * `each` の成功/失敗を差し替えられるようにし、`Symbol.asyncDispose` の
 * 呼び出し回数を観測する。
 * @param overrides - 差し替えたいメソッド
 * @param overrides.each
 */
function createFakeManager(overrides: { each?: () => Promise<undefined> } = {}) {
	const disposeSpy = vi.fn(async () => {});
	const manager = {
		ready: vi.fn(async () => {}),
		log: vi.fn(),
		each: overrides.each ?? vi.fn(async () => {}),
		[Symbol.asyncDispose]: disposeSpy,
	};
	return {
		manager: manager as unknown as ChildProcessManager<unknown, undefined>,
		disposeSpy,
	};
}

const list: URLInfo[] = [{ id: 'a', url: 'https://example.com/' }];

/**
 * `@d-zero/dealer`'s real `Dealer` hangs forever if a worker's `start()`
 * rejects (its worker-completion `.then()` has no `.catch()`, so a failed
 * worker never advances `#doneCount` — a pre-existing gap unrelated to this
 * change). Mocking `coreDeal` to drive `setup`/`start` directly isolates
 * these tests to `puppeteer-dealer`'s own `deal.ts` logic.
 * @param items
 * @param setup
 */
async function driveSetupDirectly(
	items: readonly URLInfo[],
	setup: (
		item: URLInfo,
		update: (log: string) => void,
		index: number,
		setLineHeader: (lineHeader: string) => void,
		push: (...items: URLInfo[]) => Promise<void>,
	) => Promise<() => void | Promise<void>> | (() => void | Promise<void>),
) {
	for (const [index, item] of items.entries()) {
		const start = await setup(item, vi.fn(), index, vi.fn(), vi.fn());
		await start().catch(() => {});
	}
}

describe('deal (puppeteer-dealer)', () => {
	test('disposes the process manager even when each() rejects', async () => {
		const { manager, disposeSpy } = createFakeManager({
			each: vi.fn(() => {
				throw new Error('boom');
			}),
		});
		vi.mocked(coreDeal).mockImplementation(driveSetupDirectly as never);

		await deal(
			list,
			() => '',
			() => () => manager,
			{ verbose: true },
		);

		expect(disposeSpy).toHaveBeenCalledTimes(1);
	});

	test('disposes the process manager on the success path too', async () => {
		const { manager, disposeSpy } = createFakeManager();
		vi.mocked(coreDeal).mockImplementation(driveSetupDirectly as never);

		await deal(
			list,
			() => '',
			() => () => manager,
			{ verbose: true },
		);

		expect(disposeSpy).toHaveBeenCalledTimes(1);
	});
});
