import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Display } from './display.js';

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	stdoutWriteSpy.mockRestore();
});

describe('Display listener lifecycle', () => {
	test('close() removes the resize and SIGINT listeners in non-verbose mode', () => {
		const resizeBefore = process.stdout.listenerCount('resize');
		const sigintBefore = process.listenerCount('SIGINT');

		const display = new Display();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);
		expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);

		display.close();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
		expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
	});

	test('close() removes the resize listener in verbose mode', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const display = new Display({ verbose: true });
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);

		display.close();
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('close() removes the resize listener after switching to verbose mode mid-flight', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const display = new Display();
		display.verboseMode();
		display.close();

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('repeated create/close cycles do not accumulate listeners (verbose mode)', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		// More cycles than the default MaxListeners limit (10) — this leaked
		// before the fix and triggered MaxListenersExceededWarning
		for (let i = 0; i < 20; i++) {
			const display = new Display({ verbose: true });
			display.close();
		}

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});

	test('close() is idempotent', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const display = new Display();
		display.close();
		display.close();

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});
});
