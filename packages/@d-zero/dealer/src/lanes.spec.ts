import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Lanes } from './lanes.js';

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	stdoutWriteSpy.mockRestore();
});

describe('Lanes dispose', () => {
	test('close() releases the underlying Display resize listener', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const lanes = new Lanes();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);

		lanes.close();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('using releases the underlying Display resize listener on scope exit', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		{
			using lanes = new Lanes();
			expect(lanes).toBeInstanceOf(Lanes);
			expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);
		}

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('[Symbol.dispose] and close() both delegate to the same release logic (idempotent together)', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const lanes = new Lanes();
		lanes[Symbol.dispose]();
		lanes.close();

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});
});

describe('Lanes verbose update', () => {
	test('update() without header() writes the log with no "undefined" prefix', () => {
		using lanes = new Lanes({ verbose: true });

		lanes.update(0, 'some log message');

		expect(stdoutWriteSpy).toHaveBeenCalledWith(
			expect.stringContaining('some log message'),
		);
		expect(stdoutWriteSpy).not.toHaveBeenCalledWith(expect.stringContaining('undefined'));
	});

	test('update() after header() still prefixes the log with the header', () => {
		using lanes = new Lanes({ verbose: true });

		lanes.header('My Header');
		lanes.update(0, 'some log message');

		const lastCall = stdoutWriteSpy.mock.calls.at(-1)?.[0] as string;
		expect(lastCall).toContain('My Header');
		expect(lastCall).toContain('some log message');
	});

	test('update() after header("") still writes without a prefix (empty string is falsy)', () => {
		using lanes = new Lanes({ verbose: true });

		lanes.header('');
		lanes.update(0, 'some log message');

		const lastCall = stdoutWriteSpy.mock.calls.at(-1)?.[0] as string;
		expect(lastCall).not.toContain('undefined');
	});
});
