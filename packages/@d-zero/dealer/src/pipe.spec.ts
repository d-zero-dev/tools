import { test, expect, vi, beforeEach, afterEach } from 'vitest';

import { pipe } from './pipe.js';

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	stdoutWriteSpy.mockRestore();
});

test('registers the first step as pending before running', () => {
	const pipeline = pipe('fetch', () => 1);

	expect(pipeline.steps).toStrictEqual([
		{ name: 'fetch', state: 'pending', message: '' },
	]);
});

test('resolves with the first step return value when run without further pipe() calls', async () => {
	const pipeline = pipe('answer', () => 42);

	await expect(pipeline.run()).resolves.toBe(42);
});

test('the first step receives undefined as input', async () => {
	const pipeline = pipe('identity', (input) => input);

	await expect(pipeline.run()).resolves.toBeUndefined();
});
