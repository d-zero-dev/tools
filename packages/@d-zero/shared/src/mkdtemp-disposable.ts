import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * 一時ディレクトリを作成し、`using` 宣言のスコープ脱出時に自動で削除する
 * `AsyncDisposable` ハンドルを返す。
 *
 * `prefix` が相対パスの場合は OS の一時ディレクトリ配下に解決される
 * （素の `fs.mkdtemp()` と異なり、プロセスのカレントディレクトリ直下に
 * 作成してしまう事故を防ぐ）。絶対パスの場合はそのまま使用する。
 * @param prefix - 一時ディレクトリ名のプレフィックス。省略時は OS の一時ディレクトリ配下に `d-zero-` プレフィックスで作成する
 * @returns 作成したディレクトリの絶対パス（`path`）と、スコープ脱出時に再帰削除する `AsyncDisposable`
 * @example
 * ```ts
 * {
 *   await using tmpDir = await mkdtempDisposable('my-tool-');
 *   await writeFile(`${tmpDir.path}/data.json`, '{}');
 * } // スコープ脱出時に自動で tmpDir.path が再帰削除される
 * ```
 */
export async function mkdtempDisposable(
	prefix?: string,
): Promise<{ path: string } & AsyncDisposable> {
	const resolvedPrefix =
		prefix == null
			? path.join(os.tmpdir(), 'd-zero-')
			: path.isAbsolute(prefix)
				? prefix
				: path.join(os.tmpdir(), prefix);
	const dirPath = await fs.mkdtemp(resolvedPrefix);

	return {
		path: dirPath,
		async [Symbol.asyncDispose]() {
			await fs.rm(dirPath, { recursive: true, force: true });
		},
	};
}
