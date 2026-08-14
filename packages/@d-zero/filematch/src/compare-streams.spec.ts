import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

import { compareStreams } from './compare-streams.js';

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'filematch-spec-'));
	await writeFile(path.join(dir, 'a.txt'), 'same content');
	await writeFile(path.join(dir, 'b.txt'), 'same content');
	await writeFile(path.join(dir, 'c.txt'), 'diff content');
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('compareStreams', () => {
	test('resolves true for streams with identical contents', async () => {
		const stream1 = createReadStream(path.join(dir, 'a.txt'));
		const stream2 = createReadStream(path.join(dir, 'b.txt'));

		await expect(compareStreams(stream1, stream2)).resolves.toBe(true);
	});

	test('resolves false for streams with different contents', async () => {
		const stream1 = createReadStream(path.join(dir, 'a.txt'));
		const stream2 = createReadStream(path.join(dir, 'c.txt'));

		await expect(compareStreams(stream1, stream2)).resolves.toBe(false);
	});

	test('rejects when a stream errors, destroying BOTH streams (the healthy stream must not stay open)', async () => {
		const broken = createReadStream(path.join(dir, 'no-such-file.txt'));
		const healthy = createReadStream(path.join(dir, 'a.txt'));

		await expect(compareStreams(broken, healthy)).rejects.toThrow(/ENOENT/);

		expect(broken.destroyed).toBe(true);
		expect(healthy.destroyed).toBe(true);
	});
});
