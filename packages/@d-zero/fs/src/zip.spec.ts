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

	test('zip() attaches the output stream error as Error.cause when the output path is not writable', async () => {
		const error = await zip(
			path.join(dir, 'no-such-dir-cause', 'out.zip'),
			path.join(dir, 'src'),
		).catch((error_: unknown) => error_);

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('Failed to save file');
		expect((error as Error & { cause?: NodeJS.ErrnoException }).cause?.code).toBe(
			'ENOENT',
		);
	});

	test('unzip() rejects (instead of crashing on an unhandled error event) when the zip file does not exist', async () => {
		await expect(
			unzip(path.join(dir, 'no-such.zip'), path.join(dir, 'extracted2')),
		).rejects.toThrow(/ENOENT/);
	});

	test('zip() does not leave unhandled ENOENT after rejecting when the source directory is deleted', async () => {
		// 出力先失敗後も archiver がソースを読み続けると、削除後の open が
		// uncaught ENOENT になる（nightly macOS でテスト全パスなのに exit 1）。
		// 試行 8 × ファイル 80 × 10KB: 修正前は同規模で複数回 uncaught。
		// 待機 500ms: 遅延 open が 300ms 超でも拾えるよう余裕を取る。
		const leaked: unknown[] = [];
		const onUncaught = (err: unknown) => {
			leaked.push(err);
		};
		const onUnhandled = (reason: unknown) => {
			leaked.push(reason);
		};
		process.on('uncaughtException', onUncaught);
		process.on('unhandledRejection', onUnhandled);

		try {
			for (let attempt = 0; attempt < 8; attempt++) {
				const localDir = await mkdtemp(path.join(tmpdir(), 'fs-zip-abort-spec-'));
				try {
					const srcDir = path.join(localDir, 'src');
					await mkdir(path.join(srcDir, 'nested'), { recursive: true });
					for (let i = 0; i < 80; i++) {
						await writeFile(path.join(srcDir, `f${i}.txt`), 'x'.repeat(10_000));
					}
					await writeFile(path.join(srcDir, 'nested', 'deep.txt'), 'nested content');

					await expect(
						zip(path.join(localDir, 'no-such-dir', 'out.zip'), srcDir),
					).rejects.toThrow('Failed to save file');
				} finally {
					await rm(localDir, { recursive: true, force: true });
				}
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			expect(leaked, `uncaught after zip reject+rm: ${String(leaked[0])}`).toEqual([]);
		} finally {
			process.off('uncaughtException', onUncaught);
			process.off('unhandledRejection', onUnhandled);
		}
	}, 30_000);
});
