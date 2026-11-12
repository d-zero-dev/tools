import type { Page } from 'puppeteer';

import { describe, expect, it, vi } from 'vitest';

import { getHtmlAfterNetworkIdle } from './get-html-after-network-idle.js';

type CallName = 'waitForNetworkIdle' | 'evaluate' | 'waitForNavigation';

describe('getHtmlAfterNetworkIdle', () => {
	it('waits for network idle before evaluating HTML, and never calls waitForNavigation', async () => {
		const calls: CallName[] = [];
		const waitForNavigation = vi.fn(() => {
			calls.push('waitForNavigation');
			return Promise.resolve();
		});
		const waitForNetworkIdle = vi.fn(() => {
			calls.push('waitForNetworkIdle');
			return Promise.resolve();
		});
		const evaluate = vi.fn(() => {
			calls.push('evaluate');
			return Promise.resolve({
				title: 'Settled',
				html: '<html><body data-marker="after-idle"></body></html>',
			});
		});
		const page = {
			waitForNavigation,
			waitForNetworkIdle,
			evaluate,
		} as unknown as Page;

		const result = await getHtmlAfterNetworkIdle(page);

		expect(waitForNavigation).not.toHaveBeenCalled();
		expect(waitForNetworkIdle).toHaveBeenCalledWith({
			idleTime: 500,
			concurrency: 0,
			timeout: 5000,
		});
		expect(calls.indexOf('waitForNetworkIdle')).toBeLessThan(calls.indexOf('evaluate'));
		expect(result.html).toContain('data-marker="after-idle"');
		expect(result.title).toBe('Settled');
	});

	it('still returns HTML when network idle rejects for any reason', async () => {
		const waitForNetworkIdle = vi.fn(() => Promise.reject(new Error('Page closed!')));
		const evaluate = vi.fn(() =>
			Promise.resolve({
				title: 'Timed out',
				html: '<html><body data-marker="after-reject"></body></html>',
			}),
		);
		const page = { waitForNetworkIdle, evaluate } as unknown as Page;

		const result = await getHtmlAfterNetworkIdle(page);

		expect(result.html).toContain('data-marker="after-reject"');
		expect(result.title).toBe('Timed out');
		expect(evaluate).toHaveBeenCalledTimes(1);
	});

	it('invokes beforeEvaluate after idle and before evaluate', async () => {
		const calls: string[] = [];
		const waitForNetworkIdle = vi.fn(() => {
			calls.push('waitForNetworkIdle');
			return Promise.resolve();
		});
		const evaluate = vi.fn(() => {
			calls.push('evaluate');
			return Promise.resolve({ title: 'T', html: '<html></html>' });
		});
		const page = { waitForNetworkIdle, evaluate } as unknown as Page;

		await getHtmlAfterNetworkIdle(page, () => {
			calls.push('beforeEvaluate');
		});

		expect(calls).toEqual(['waitForNetworkIdle', 'beforeEvaluate', 'evaluate']);
	});
});
