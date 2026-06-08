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

	test('repeated create/close cycles do not accumulate listeners or emit MaxListenersExceededWarning (verbose mode)', () => {
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

describe('Display.write() after close()', () => {
	test('non-verbose: write() does not restart the animation timer or touch stdout', () => {
		const display = new Display();
		display.close();
		stdoutWriteSpy.mockClear();

		display.write('late message');

		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});

	test('verbose: write() does not touch stdout', () => {
		const display = new Display({ verbose: true });
		display.close();
		stdoutWriteSpy.mockClear();

		display.write('late message');

		expect(stdoutWriteSpy).not.toHaveBeenCalled();
	});
});
