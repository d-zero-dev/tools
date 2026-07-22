import type { ConsoleMessage, ConsoleMessageLocation, JSHandle } from 'puppeteer';

import { describe, expect, it, vi } from 'vitest';

import { toConsoleLogEntry } from './to-console-log-entry.js';

/**
 * Builds a minimal `JSHandle` mock whose `jsonValue()` resolves with the given value.
 * @param value
 */
function mockArg(value: unknown): JSHandle {
	return {
		jsonValue: () => Promise.resolve(value),
		dispose: () => Promise.resolve(),
	} as unknown as JSHandle;
}

/**
 * Builds a `JSHandle` mock whose `jsonValue()` rejects, simulating a handle
 * that can no longer be resolved (e.g. a destroyed execution context).
 * @param reason
 */
function mockRejectingArg(reason: unknown): JSHandle {
	return {
		jsonValue: () => Promise.reject(reason),
		dispose: () => Promise.resolve(),
	} as unknown as JSHandle;
}

/**
 * Builds a minimal `ConsoleMessage` mock.
 * @param options
 * @param options.type
 * @param options.text
 * @param options.args
 * @param options.location
 */
function mockConsoleMessage(options: {
	type?: string;
	text?: string;
	args?: JSHandle[];
	location?: ConsoleMessageLocation;
}): ConsoleMessage {
	return {
		type: () => options.type ?? 'log',
		text: () => options.text ?? '',
		args: () => options.args ?? [],
		location: () => options.location ?? {},
	} as unknown as ConsoleMessage;
}

describe('toConsoleLogEntry', () => {
	it('resolves text, type, and pageUrl', async () => {
		const msg = mockConsoleMessage({ type: 'warn', text: 'careful' });
		const entry = await toConsoleLogEntry(msg, 'https://example.com/');

		expect(entry.pageUrl).toBe('https://example.com/');
		expect(entry.type).toBe('warn');
		expect(entry.text).toBe('careful');
		expect(entry.args).toEqual([]);
	});

	it('resolves each argument via jsonValue()', async () => {
		const msg = mockConsoleMessage({
			args: [mockArg('a'), mockArg(1), mockArg({ b: 2 })],
		});
		const entry = await toConsoleLogEntry(msg, 'https://example.com/');

		expect(entry.args).toEqual(['a', 1, { b: 2 }]);
	});

	it('falls back to undefined for an argument whose jsonValue() rejects', async () => {
		const msg = mockConsoleMessage({
			args: [mockArg('ok'), mockRejectingArg(new Error('destroyed context'))],
		});
		const entry = await toConsoleLogEntry(msg, 'https://example.com/');

		expect(entry.args).toEqual(['ok', undefined]);
	});

	it('disposes each argument handle after resolving', async () => {
		const arg = mockArg('a');
		const disposeSpy = vi.spyOn(arg, 'dispose');
		const msg = mockConsoleMessage({ args: [arg] });
		await toConsoleLogEntry(msg, 'https://example.com/');

		expect(disposeSpy).toHaveBeenCalledOnce();
	});

	it('keeps location when the message has a source URL', async () => {
		const location = {
			url: 'https://example.com/app.js',
			lineNumber: 3,
			columnNumber: 7,
		};
		const msg = mockConsoleMessage({ location });
		const entry = await toConsoleLogEntry(msg, 'https://example.com/');

		expect(entry.location).toEqual(location);
	});

	it('omits location when the message has no source URL', async () => {
		const msg = mockConsoleMessage({ location: {} });
		const entry = await toConsoleLogEntry(msg, 'https://example.com/');

		expect(entry.location).toBeUndefined();
	});
});
