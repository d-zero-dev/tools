import type { Page } from 'puppeteer';

import { describe, expect, it, vi } from 'vitest';

import { awaitPageNetworkIdle } from './await-page-network-idle.js';

describe('awaitPageNetworkIdle', () => {
	it('calls waitForNetworkIdle with networkidle0-equivalent options and never waitForNavigation', async () => {
		const waitForNavigation = vi.fn(() => Promise.resolve());
		const waitForNetworkIdle = vi.fn(() => Promise.resolve());
		const page = { waitForNavigation, waitForNetworkIdle } as unknown as Page;

		await awaitPageNetworkIdle(page);

		expect(waitForNavigation).not.toHaveBeenCalled();
		expect(waitForNetworkIdle).toHaveBeenCalledTimes(1);
		expect(waitForNetworkIdle).toHaveBeenCalledWith({
			idleTime: 500,
			concurrency: 0,
			timeout: 5000,
		});
	});

	it('swallows timeout rejections so the caller can continue', async () => {
		const waitForNetworkIdle = vi.fn(() =>
			Promise.reject(new Error('Network idle timeout of 5000 ms exceeded')),
		);
		const page = { waitForNetworkIdle } as unknown as Page;

		await expect(awaitPageNetworkIdle(page)).resolves.toBeUndefined();
	});

	it('swallows non-timeout rejections so the caller can continue', async () => {
		const waitForNetworkIdle = vi.fn(() => Promise.reject(new Error('Page closed!')));
		const page = { waitForNetworkIdle } as unknown as Page;

		await expect(awaitPageNetworkIdle(page)).resolves.toBeUndefined();
	});
});
