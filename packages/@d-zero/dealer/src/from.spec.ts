import { test, expect, vi, beforeEach, afterEach } from 'vitest';

import { from } from './from.js';

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	stdoutWriteSpy.mockRestore();
});

test('starts with no steps registered', () => {
	const pipeline = from(42);

	expect(pipeline.steps).toStrictEqual([]);
});

test('passes the initial value into the first piped step', async () => {
	const pipeline = from(42).pipe('double', (n) => n * 2);

	await expect(pipeline.run()).resolves.toBe(84);
});

test('resolves with the initial value untouched when no steps are piped', async () => {
	const pipeline = from('seed');

	await expect(pipeline.run()).resolves.toBe('seed');
});
