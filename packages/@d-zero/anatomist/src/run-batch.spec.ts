import { deal } from '@d-zero/dealer';
import { launch } from 'puppeteer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzePageLayout } from './analyze-page-layout.js';
import { runBatch } from './run-batch.js';

vi.mock('puppeteer', () => ({
	launch: vi.fn(),
}));

vi.mock('@d-zero/dealer', () => ({
	deal: vi.fn(),
}));

vi.mock('./analyze-page-layout.js', () => ({
	analyzePageLayout: vi.fn(),
}));

/**
 * Drives `deal`'s mock the same way the real implementation would: call
 * `setup` for every item, then invoke the `start` function it returns.
 * Sequential rather than concurrent — batch ordering isn't under test here.
 */
function makeSequentialDealMock() {
	return vi.fn(
		async (items: readonly unknown[], setup: (...args: unknown[]) => unknown) => {
			for (const [index, item] of items.entries()) {
				const update = vi.fn();
				const setLineHeader = vi.fn();
				const push = vi.fn();
				const unshift = vi.fn();
				const start = (await setup(
					item,
					update,
					index,
					setLineHeader,
					push,
					unshift,
				)) as () => Promise<void>;
				await start();
			}
		},
	);
}

describe('runBatch', () => {
	let mockPage: {
		close: ReturnType<typeof vi.fn>;
		[Symbol.asyncDispose]: ReturnType<typeof vi.fn>;
	};
	let mockBrowser: {
		newPage: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
		[Symbol.asyncDispose]: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		// `run-batch.ts` now uses `await using`, which requires a real
		// `Symbol.asyncDispose` implementation — delegate to the existing
		// `close` mock so assertions on `close` call counts stay meaningful.
		mockPage = {
			close: vi.fn().mockResolvedValue(),
			[Symbol.asyncDispose]: vi.fn(),
		};
		mockPage[Symbol.asyncDispose].mockImplementation(async () => {
			await mockPage.close();
		});

		mockBrowser = {
			newPage: vi.fn().mockResolvedValue(mockPage),
			close: vi.fn().mockResolvedValue(),
			[Symbol.asyncDispose]: vi.fn(),
		};
		mockBrowser[Symbol.asyncDispose].mockImplementation(async () => {
			await mockBrowser.close();
		});

		vi.mocked(launch).mockResolvedValue(mockBrowser as never);
		vi.mocked(deal).mockImplementation(makeSequentialDealMock() as never);
		vi.mocked(analyzePageLayout).mockReset().mockResolvedValue([]);
	});

	it('launches one browser for the whole batch and closes it afterward', async () => {
		await runBatch(['https://a.example/']);

		expect(launch).toHaveBeenCalledTimes(1);
		expect(mockBrowser.close).toHaveBeenCalledTimes(1);
	});

	it('opens and closes one page per URL', async () => {
		await runBatch(['https://a.example/', 'https://b.example/']);

		expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
		expect(mockPage.close).toHaveBeenCalledTimes(2);
	});

	it("passes the requested concurrency as deal's limit", async () => {
		await runBatch(['https://a.example/'], { concurrency: 4 });

		expect(deal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ limit: 4 }),
		);
	});

	it('clamps a concurrency of 0 up to 1 instead of passing it through (would otherwise hang forever)', async () => {
		await runBatch(['https://a.example/'], { concurrency: 0 });

		expect(deal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ limit: 1 }),
		);
	});

	it('defaults concurrency to 1', async () => {
		await runBatch(['https://a.example/']);

		expect(deal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ limit: 1 }),
		);
	});

	it('calls onResult for every result analyzePageLayout returns', async () => {
		const resultA = {
			url: 'https://a.example/',
			viewport: { name: 'pc', width: 1280 },
			mainSelector: null,
			root: null,
		};
		vi.mocked(analyzePageLayout).mockResolvedValue([resultA]);
		const onResult = vi.fn();

		await runBatch(['https://a.example/'], { onResult });

		expect(onResult).toHaveBeenCalledWith(resultA);
	});

	it('routes a failing URL to onError instead of aborting the batch', async () => {
		vi.mocked(analyzePageLayout)
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce([]);
		const onError = vi.fn();

		await runBatch(['https://bad.example/', 'https://good.example/'], { onError });

		expect(onError).toHaveBeenCalledWith('https://bad.example/', expect.any(Error));
		expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
	});

	it('closes the page even when analyzePageLayout throws', async () => {
		vi.mocked(analyzePageLayout).mockRejectedValueOnce(new Error('boom'));

		await runBatch(['https://bad.example/'], { onError: vi.fn() });

		expect(mockPage.close).toHaveBeenCalledTimes(1);
	});
});
