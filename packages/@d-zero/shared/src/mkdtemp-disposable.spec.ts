import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, test, expect } from 'vitest';

import { mkdtempDisposable } from './mkdtemp-disposable.js';

describe('mkdtempDisposable', () => {
	test('creates a directory and removes it on scope exit', async () => {
		let createdPath: string;
		{
			await using tmpDir = await mkdtempDisposable(
				path.join(os.tmpdir(), 'mkdtemp-disposable-spec-'),
			);
			createdPath = tmpDir.path;
			const stat = await fs.stat(createdPath);
			expect(stat.isDirectory()).toBe(true);
		}
		await expect(fs.stat(createdPath)).rejects.toThrow();
	});

	test('resolves a bare (relative) prefix under os.tmpdir(), not the CWD', async () => {
		await using tmpDir = await mkdtempDisposable('mkdtemp-disposable-spec-');
		expect(path.isAbsolute(tmpDir.path)).toBe(true);
		// macOS では os.tmpdir() がシンボリックリンク（/var → /private/var）の
		// ことがあるため、実体パス同士で比較する
		const realTmp = await fs.realpath(os.tmpdir());
		const realDir = await fs.realpath(tmpDir.path);
		expect(realDir.startsWith(realTmp)).toBe(true);
		expect(realDir.startsWith(await fs.realpath(process.cwd()))).toBe(false);
	});

	test('removes non-empty directories recursively', async () => {
		let createdPath: string;
		{
			await using tmpDir = await mkdtempDisposable(
				path.join(os.tmpdir(), 'mkdtemp-disposable-spec-'),
			);
			createdPath = tmpDir.path;
			await fs.mkdir(path.join(createdPath, 'nested'));
			await fs.writeFile(path.join(createdPath, 'nested', 'file.txt'), 'data');
		}
		await expect(fs.stat(createdPath)).rejects.toThrow();
	});
});
