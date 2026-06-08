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

	test('repeated create/close cycles do not accumulate listeners or emit MaxListenersExceededWarning (verbose mode)', async () => {
		const resizeBefore = process.stdout.listenerCount('resize');
		const warnings: Error[] = [];
		const captureWarning = (warning: Error) => warnings.push(warning);
		process.on('warning', captureWarning);

		try {
			// More cycles than the default MaxListeners limit (10) — this leaked
			// before the fix and triggered MaxListenersExceededWarning
			for (let i = 0; i < 20; i++) {
				const display = new Display({ verbose: true });
				display.close();
			}
			// process.emitWarning is dispatched via process.nextTick.
			// Without yielding the event loop here, captureWarning would
			// never have run before the assertion below — making this test
			// silently pass even when a regression emits the warning
			await new Promise((resolve) => setImmediate(resolve));
			await new Promise((resolve) => setImmediate(resolve));
		} finally {
			process.off('warning', captureWarning);
		}

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
		// Catches the second-tier leak: a regression that keeps listenerCount
		// stable but trips Node's threshold (e.g. an extra registration somewhere)
		// still shows up as a MaxListenersExceededWarning emission
		expect(warnings.filter((w) => w.name === 'MaxListenersExceededWarning')).toHaveLength(
			0,
		);
	});

	test('close() is idempotent', () => {
		const resizeBefore = process.stdout.listenerCount('resize');

		const display = new Display();
		display.close();
		display.close();

		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
	});
});

describe('Display.close() finalization', () => {
	test('non-verbose: close() flushes one final frame after a pending write()', () => {
		const display = new Display();
		display.write('pending');
		stdoutWriteSpy.mockClear();

		display.close();

		// In non-verbose mode close() calls #write() one last time to render
		// the final stack into the terminal before tearing down
		expect(stdoutWriteSpy).toHaveBeenCalled();
	});

	test('verbose: close() does not emit any extra stdout output', () => {
		const display = new Display({ verbose: true });
		display.write('pending');
		stdoutWriteSpy.mockClear();

		display.close();

		// Verbose mode writes synchronously inside write(); close() must
		// skip the interactive #write() path that exists only for the
		// frame-buffered renderer, otherwise the last log would be duplicated
		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});

	test('close() detaches the resize callback so a later resize emit is a no-op', () => {
		const display = new Display();
		display.close();
		stdoutWriteSpy.mockClear();

		process.stdout.emit('resize');

		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});
});

describe('Display SIGINT handler', () => {
	test('SIGINT handler closes the display and exits with code 130', () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
		const sigintBefore = process.listeners('SIGINT').length;
		const resizeBefore = process.stdout.listenerCount('resize');

		const display = new Display();
		const installed = process.listeners('SIGINT').slice(sigintBefore);
		expect(installed).toHaveLength(1);
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore + 1);

		(installed[0] as () => void)();

		expect(exitSpy).toHaveBeenCalledWith(130);
		// close() was invoked through the handler — listeners must be released
		expect(process.stdout.listenerCount('resize')).toBe(resizeBefore);
		expect(process.listeners('SIGINT').length).toBe(sigintBefore);

		// Defensive: avoid hanging-handle warnings if the runtime kept the
		// reference. close() is idempotent so calling it again is safe
		display.close();
		exitSpy.mockRestore();
	});

	test('verbose mode does not register a SIGINT handler', () => {
		const sigintBefore = process.listeners('SIGINT').length;

		const display = new Display({ verbose: true });
		expect(process.listeners('SIGINT').length).toBe(sigintBefore);

		display.close();
	});
});

describe('Display.verboseMode() switch', () => {
	test('verboseMode() makes a subsequent write() print synchronously to stdout', () => {
		const display = new Display();
		display.verboseMode();
		stdoutWriteSpy.mockClear();

		display.write('after switch');

		expect(stdoutWriteSpy).toHaveBeenCalled();
		display.close();
	});

	test('verboseMode() after close() does not revive writes', () => {
		const display = new Display();
		display.close();
		stdoutWriteSpy.mockClear();

		display.verboseMode();
		display.write('after close+verbose');

		// The #closed guard in write() supersedes the verbose flag — the
		// lifecycle is over and verboseMode() flipping a bit must not reopen it
		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});
});

describe('Display.write() after close()', () => {
	test('non-verbose: write() does not restart the animation timer or touch stdout', () => {
		vi.useFakeTimers();
		try {
			const display = new Display();
			display.close();
			stdoutWriteSpy.mockClear();

			display.write('late message');

			// Direct observation of the timer state: if the #closed guard
			// regresses, #enterFrame() would re-arm setTimeout and getTimerCount
			// would jump to 1. Asserting on stdoutWriteSpy alone was indirect
			// (it relied on #enterFrame calling #write synchronously)
			expect(vi.getTimerCount()).toBe(0);
			expect(stdoutWriteSpy).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	test('verbose: write() does not touch stdout', () => {
		const display = new Display({ verbose: true });
		display.close();
		stdoutWriteSpy.mockClear();

		display.write('late message');

		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});
});
