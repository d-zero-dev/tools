import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

import { unzip, zip } from './zip.js';

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'fs-zip-spec-'));
	await mkdir(path.join(dir, 'src', 'nested'), { recursive: true });
	await writeFile(path.join(dir, 'src', 'hello.txt'), 'hello zip');
	await writeFile(path.join(dir, 'src', 'nested', 'deep.txt'), 'nested content');
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('zip / unzip', () => {
	test('round-trips a directory: zipped archive extracts to identical file contents', async () => {
		const zipPath = path.join(dir, 'out.zip');
		const extractDir = path.join(dir, 'extracted');

		await zip(zipPath, path.join(dir, 'src'));
		await unzip(zipPath, extractDir);

		expect(await readFile(path.join(extractDir, 'hello.txt'), 'utf8')).toBe('hello zip');
		expect(await readFile(path.join(extractDir, 'nested', 'deep.txt'), 'utf8')).toBe(
			'nested content',
		);
	});

	test('zip() rejects (instead of crashing on an unhandled error event) when the output path is not writable', async () => {
		await expect(
			zip(path.join(dir, 'no-such-dir', 'out.zip'), path.join(dir, 'src')),
		).rejects.toThrow('Failed to save file');
	});

	test('unzip() rejects (instead of crashing on an unhandled error event) when the zip file does not exist', async () => {
		await expect(
			unzip(path.join(dir, 'no-such.zip'), path.join(dir, 'extracted2')),
		).rejects.toThrow(/ENOENT/);
	});
});
