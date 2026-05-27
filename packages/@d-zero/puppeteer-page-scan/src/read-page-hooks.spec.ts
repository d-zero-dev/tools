import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readPageHooks } from './read-page-hooks.js';

const fixturesDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'__fixtures__',
);

describe('readPageHooks', () => {
	it('空配列を渡すと空配列を返す', async () => {
		const result = await readPageHooks([], fixturesDir);
		expect(result).toEqual([]);
	});

	it('相対パスは baseDir 基準で解決して関数として返す', async () => {
		const result = await readPageHooks(['./valid-hook.mjs'], fixturesDir);
		expect(result).toHaveLength(1);
		expect(typeof result[0]).toBe('function');
	});

	it('絶対パスはそのまま import される', async () => {
		const absPath = path.resolve(fixturesDir, 'valid-hook.mjs');
		const result = await readPageHooks([absPath], '/nonexistent-base');
		expect(result).toHaveLength(1);
		expect(typeof result[0]).toBe('function');
	});

	it('.cjs ファイルも読み込める', async () => {
		const result = await readPageHooks(['./valid-hook.cjs'], fixturesDir);
		expect(result).toHaveLength(1);
		expect(typeof result[0]).toBe('function');
	});

	it('読み込んだ関数を呼ぶと期待どおりに動く', async () => {
		const [hook] = await readPageHooks(['./valid-hook.mjs'], fixturesDir);
		const logs: string[] = [];
		await hook!(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			{
				name: 'desktop',
				width: 1024,
				log: (message: string) => logs.push(message),
			},
		);
		expect(logs).toEqual(['valid-hook.mjs ran on desktop']);
	});

	it('複数の hook をまとめて読み込み、配列順を保つ', async () => {
		const result = await readPageHooks(
			['./valid-hook.mjs', './valid-hook.cjs'],
			fixturesDir,
		);
		expect(result).toHaveLength(2);
		expect(result.every((fn) => typeof fn === 'function')).toBe(true);
	});

	it('存在しないパスは "not found" を含むエラーを投げる', async () => {
		await expect(readPageHooks(['./missing-hook.mjs'], fixturesDir)).rejects.toThrow(
			/not found/,
		);
	});

	it('default export が関数でないファイルは TypeError を投げる', async () => {
		await expect(readPageHooks(['./not-a-function.mjs'], fixturesDir)).rejects.toThrow(
			TypeError,
		);
	});
});
