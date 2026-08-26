import { Writable } from 'node:stream';

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Lanes } from './lanes.js';

/**
 * `Writable` stub that collects every painted frame so assertions can grep the
 * rendered text. Passed as `stream` so the test never touches `process.stdout`.
 */
function makeStreamCollector(): {
	readonly stream: NodeJS.WritableStream;
	read(): string;
} {
	const chunks: Buffer[] = [];
	const stream = new Writable({
		write(chunk: Buffer | string, _encoding, cb) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			cb();
		},
	});
	return { stream, read: () => Buffer.concat(chunks).toString('utf8') };
}

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

describe('Lanes countdown lifetime', () => {
	test('a lane-scoped countdown id restarts from its full duration on the next item', () => {
		vi.useFakeTimers();
		try {
			const collector = makeStreamCollector();
			using lanes = new Lanes({ stream: collector.stream });

			// deal() が各アイテムの待機に出す、レーン番号だけを ID にした行
			lanes.update(0, 'Waiting interval: %countdown(1000,0_interval)%ms');
			vi.advanceTimersByTime(1500);
			lanes.update(0, 'Scraping');
			lanes.delete(0);

			const mark = collector.read().length;
			lanes.update(0, 'Waiting interval: %countdown(1000,0_interval)%ms');
			collector.stream.emit('resize');

			expect(collector.read().slice(mark)).toContain('Waiting interval: 1000ms');
		} finally {
			vi.useRealTimers();
		}
	});

	test('a countdown on another lane keeps counting while a vanished one is dropped', () => {
		vi.useFakeTimers();
		try {
			const collector = makeStreamCollector();
			using lanes = new Lanes({ stream: collector.stream });

			lanes.update(0, 'lane0 %countdown(1000,0_interval)%ms');
			lanes.update(1, 'lane1 %countdown(1000,1_interval)%ms');
			vi.advanceTimersByTime(400);
			lanes.delete(1);

			const mark = collector.read().length;
			lanes.update(1, 'lane1 %countdown(1000,1_interval)%ms');
			collector.stream.emit('resize');
			const painted = collector.read().slice(mark);

			expect(painted).toContain('lane0 600ms');
			expect(painted).toContain('lane1 1000ms');
		} finally {
			vi.useRealTimers();
		}
	});
});
