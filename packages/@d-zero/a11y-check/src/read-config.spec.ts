import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readConfig } from './read-config.js';

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await mkdtemp(path.join(os.tmpdir(), 'd-zero-a11y-readconfig-'));
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

/**
 *
 * @param content
 */
async function writeConfig(content: string): Promise<string> {
	const filePath = path.join(tmpDir, 'url-list.txt');
	await writeFile(filePath, content, 'utf8');
	return filePath;
}

describe('readConfig (a11y-check)', () => {
	it('hooks 未指定時は paths が空配列、baseDir は設定ファイルのディレクトリを指す', async () => {
		const filePath = await writeConfig(
			['---', '---', 'https://example.com/a'].join('\n'),
		);

		const result = await readConfig(filePath);

		expect(result.hooks).toEqual({ paths: [], baseDir: tmpDir });
	});

	it('hooks 指定時は paths を front-matter から抽出する', async () => {
		const filePath = await writeConfig(
			['---', 'hooks:', '  - ./hooks/a11y.mjs', '---', 'https://example.com/a'].join(
				'\n',
			),
		);

		const result = await readConfig(filePath);

		expect(result.hooks.paths).toEqual(['./hooks/a11y.mjs']);
		expect(result.hooks.baseDir).toBe(tmpDir);
	});

	it('urlList を本文から抽出する（id 付き / id なし両対応）', async () => {
		const filePath = await writeConfig(
			['---', '---', 'pageA\thttps://example.com/a', 'https://example.com/b'].join('\n'),
		);

		const result = await readConfig(filePath);

		expect(result.urlList).toEqual([
			{ id: 'pageA', url: 'https://example.com/a' },
			{ id: null, url: 'https://example.com/b' },
		]);
	});
});
