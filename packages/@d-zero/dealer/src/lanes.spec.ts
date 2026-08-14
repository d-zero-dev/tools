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
