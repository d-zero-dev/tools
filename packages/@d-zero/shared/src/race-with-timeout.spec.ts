import { describe, test, expect, vi, afterEach } from 'vitest';

import { raceWithTimeout } from './race-with-timeout.js';

afterEach(() => {
	vi.useRealTimers();
});

describe('raceWithTimeout', () => {
	test('resolves with the result when the promise settles before the timeout', async () => {
		const { result, timeout } = await raceWithTimeout(() => 42, 5000);

		expect(result).toBe(42);
		expect(timeout).toBe(false);
	});

	test('resolves with timeout:true when the timer wins', async () => {
		vi.useFakeTimers();

		const promise = raceWithTimeout(() => new Promise<never>(() => {}), 5000);
		await vi.advanceTimersByTimeAsync(5000);
		const { result, timeout } = await promise;

		expect(result).toBeUndefined();
		expect(timeout).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('clears the timer when the promise resolves (loser-side cleanup)', async () => {
		vi.useFakeTimers();

		await raceWithTimeout(() => 'done', 5000);

		expect(vi.getTimerCount()).toBe(0);
	});

	test('clears the timer even when the promise rejects (the timer must not outlive a rejected race)', async () => {
		vi.useFakeTimers();

		await expect(
			raceWithTimeout(() => Promise.reject(new Error('boom')), 5000),
		).rejects.toThrow('boom');

		expect(vi.getTimerCount()).toBe(0);
	});

	test('rejects with the original error when the promise rejects', async () => {
		await expect(
			raceWithTimeout(() => Promise.reject(new Error('original cause')), 5000),
		).rejects.toThrow('original cause');
	});
});
