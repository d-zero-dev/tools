import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readConfig } from './read-config.js';

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await mkdtemp(path.join(os.tmpdir(), 'd-zero-arch-readconfig-'));
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

/**
 *
 * @param content
 */
async function writeConfig(content: string): Promise<string> {
	const filePath = path.join(tmpDir, 'pair-list.txt');
	await writeFile(filePath, content, 'utf8');
	return filePath;
}

describe('readConfig (archaeologist)', () => {
	it('hooks 未指定時は paths が空配列、baseDir は設定ファイルのディレクトリを指す', async () => {
		const filePath = await writeConfig(
			[
				'---',
				'comparisonHost: https://staging.example.com',
				'---',
				'https://example.com/a',
			].join('\n'),
		);

		const result = await readConfig(filePath);

		expect(result.hooks).toEqual({ paths: [], baseDir: tmpDir });
	});

	it('hooks 指定時は paths を front-matter から抽出する', async () => {
		const filePath = await writeConfig(
			[
				'---',
				'comparisonHost: https://staging.example.com',
				'hooks:',
				'  - ./hooks/freeze.mjs',
				'---',
				'https://example.com/a',
			].join('\n'),
		);

		const result = await readConfig(filePath);

		expect(result.hooks.paths).toEqual(['./hooks/freeze.mjs']);
		expect(result.hooks.baseDir).toBe(tmpDir);
	});

	it('comparisonHost からペアの urlB を組み立てる', async () => {
		const filePath = await writeConfig(
			[
				'---',
				'comparisonHost: https://staging.example.com',
				'---',
				'https://example.com/a?x=1',
			].join('\n'),
		);

		const result = await readConfig(filePath);

		expect(result.pairList).toEqual([
			['https://example.com/a?x=1', 'https://staging.example.com/a?x=1'],
		]);
	});
});
