import { Writable } from 'node:stream';

import { test, expect, vi, beforeEach, afterEach } from 'vitest';

import { pipe } from './pipe.js';

/**
 * `Writable` stub for stream-option tests. Collects every chunk into an
 * in-memory buffer and exposes the concatenated string so assertions can
 * grep for expected fragments (mirrors display.spec.ts's helper).
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

test('exposes all steps as pending before run() is called', () => {
	const pipeline = pipe('one', () => 1).pipe('two', (n) => n + 1);

	expect(pipeline.steps).toStrictEqual([
		{ name: 'one', state: 'pending', message: '' },
		{ name: 'two', state: 'pending', message: '' },
	]);
});

test('carries the transformed value through each pipe() step and resolves with the last one', async () => {
	const pipeline = pipe('one', () => 1)
		.pipe('double', (n) => n * 2)
		.pipe('stringify', (n) => `value:${n}`);

	await expect(pipeline.run()).resolves.toBe('value:2');
});

test('marks steps done after a successful run and keeps the last progress message', async () => {
	const pipeline = pipe('work', (_input, ctx) => {
		ctx.progress('halfway');
		return 'ok';
	});

	await pipeline.run();

	expect(pipeline.steps).toStrictEqual([
		{ name: 'work', state: 'done', message: 'halfway' },
	]);
});

test('rejects with TaskListStepError and stops before later steps on failure', async () => {
	const thirdRun = vi.fn();
	const original = new Error('boom');
	const pipeline = pipe('first', () => 1)
		.pipe('second', () => {
			throw original;
		})
		.pipe('third', thirdRun);

	await expect(pipeline.run()).rejects.toMatchObject({
		name: 'TaskListStepError',
		stepName: 'second',
		stepIndex: 1,
		cause: original,
	});

	expect(thirdRun).not.toHaveBeenCalled();
	expect(pipeline.steps).toStrictEqual([
		{ name: 'first', state: 'done', message: '' },
		{ name: 'second', state: 'error', message: expect.stringContaining('boom') },
		{ name: 'third', state: 'pending', message: '' },
	]);
});

test('insertNext runs the inserted step immediately after the current one, and multiple calls preserve call order', async () => {
	const order: string[] = [];
	const pipeline = pipe('first', (_input, ctx) => {
		order.push('first');
		ctx.insertNext('inserted-a', () => {
			order.push('inserted-a');
		});
		ctx.insertNext('inserted-b', () => {
			order.push('inserted-b');
		});
	}).pipe('second', () => {
		order.push('second');
	});

	await pipeline.run();

	expect(order).toStrictEqual(['first', 'inserted-a', 'inserted-b', 'second']);
});

test('insertNext does not scramble the display order of existing steps', async () => {
	const collector = makeStreamCollector();
	const pipeline = pipe('first', (_input, ctx) => {
		ctx.insertNext('inserted', () => {});
	}).pipe('second', () => {});

	await pipeline.run({ stream: collector.stream, showElapsed: false });

	const output = collector.read();
	const firstPos = output.lastIndexOf('first');
	const insertedPos = output.lastIndexOf('inserted');
	const secondPos = output.lastIndexOf('second');

	expect(firstPos).toBeGreaterThanOrEqual(0);
	expect(firstPos).toBeLessThan(insertedPos);
	expect(insertedPos).toBeLessThan(secondPos);
});

test('branching does not leak run() state mutations back into the original pipeline', async () => {
	const base = pipe('shared', () => 'value');
	const branchA = base.pipe('a-only', (v) => `${v}-a`);
	const branchB = base.pipe('b-only', (v) => `${v}-b`);

	await branchA.run();

	expect(base.steps).toStrictEqual([{ name: 'shared', state: 'pending', message: '' }]);
	expect(branchB.steps).toStrictEqual([
		{ name: 'shared', state: 'pending', message: '' },
		{ name: 'b-only', state: 'pending', message: '' },
	]);
	expect(branchA.steps).toStrictEqual([
		{ name: 'shared', state: 'done', message: '' },
		{ name: 'a-only', state: 'done', message: '' },
	]);
});

test('rejects a concurrent run() on the same instance while one is already in flight', async () => {
	const pipeline = pipe('slow', async () => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		return 'done';
	});

	const first = pipeline.run();
	await expect(pipeline.run()).rejects.toThrow(/already in progress/);

	await expect(first).resolves.toBe('done');
});

test('rejects a second run() after the first one already completed successfully', async () => {
	const pipeline = pipe('task', () => 'ok');

	await expect(pipeline.run()).resolves.toBe('ok');
	await expect(pipeline.run()).rejects.toThrow(/already completed/);
});

test('rejects a second run() after the first one already failed', async () => {
	const pipeline = pipe('task', () => {
		throw new Error('boom');
	});

	await expect(pipeline.run()).rejects.toThrow(/boom/);
	await expect(pipeline.run()).rejects.toThrow(/already completed/);
});

test('a step that calls insertNext does not duplicate the inserted step across separate run() calls', async () => {
	// insertNext splices into the shared #steps array; without the single-use
	// guard on run(), a second run() would re-run the leftover inserted step
	// from the first run AND insert a brand new one, duplicating side effects.
	const pipeline = pipe('first', (_input, ctx) => {
		ctx.insertNext('inserted', () => {});
	}).pipe('second', () => {});

	await pipeline.run();

	expect(pipeline.steps.map((step) => step.name)).toStrictEqual([
		'first',
		'inserted',
		'second',
	]);
	await expect(pipeline.run()).rejects.toThrow(/already completed/);
	expect(pipeline.steps.map((step) => step.name)).toStrictEqual([
		'first',
		'inserted',
		'second',
	]);
});

test('clears the elapsed-time interval once the running step settles', async () => {
	vi.useFakeTimers();
	try {
		const pipeline = pipe('task', () => 'ok');
		await pipeline.run();

		expect(vi.getTimerCount()).toBe(0);
	} finally {
		vi.useRealTimers();
	}
});
