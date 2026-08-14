import fs from 'node:fs';

import { ZipArchive } from 'archiver';
import unzipper from 'unzipper';

/**
 * 指定ディレクトリの内容を zip アーカイブとして書き出す。
 *
 * Why not `await using output`: Node.js の stream の `Symbol.asyncDispose` は
 * stream が既に error で終了している場合、dispose 時にその error を再度 reject
 * するため、失敗パスの reject 理由が `SuppressedError`（message は空文字列）に
 * 包まれて本来の原因が呼び出し元から見えなくなる。try/finally + `destroy()`
 * （同期・冪等・throw しない）で同等の解放保証を得る。
 * @param outputfilePath - 出力する zip ファイルのパス
 * @param targetDir - アーカイブ対象のディレクトリ
 * @example
 * ```ts
 * await zip('/path/to/output.zip', '/path/to/dir');
 * ```
 */
export async function zip(outputfilePath: string, targetDir: string) {
	const output = fs.createWriteStream(outputfilePath);
	try {
		const archive = new ZipArchive();
		archive.pipe(output);
		archive.directory(targetDir, false);

		// 'error' リスナーは finalize() の await より前に登録する。出力先が
		// 開けない場合の error は finalize() 待機中に発火するため、登録が
		// 後だと unhandled 'error' イベントとしてプロセスごとクラッシュする
		const written = new Promise<void>((resolve, reject) => {
			output.on('finish', () => resolve());
			output.on('error', () =>
				reject(new Error(`Failed to save file "${outputfilePath}" from "${targetDir}"`)),
			);
		});

		// Promise.all で両方を観測する（片方だけ await すると、もう片方の
		// 失敗が unhandled rejection になる）。出力先エラー時は 'error'
		// イベント（written 側）が finalize の失敗より先に確定する
		await Promise.all([archive.finalize(), written]);
	} finally {
		output.destroy();
	}
}

/**
 * zip アーカイブを指定ディレクトリへ展開する。
 *
 * Why not `await using input`: {@link zip} と同じく、error で終了した stream の
 * `Symbol.asyncDispose` が原因の error を `SuppressedError` で二重包装するため。
 * @param zipFilePath - 展開する zip ファイルのパス
 * @param targetDir - 展開先ディレクトリ
 * @example
 * ```ts
 * await unzip('/path/to/archive.zip', '/path/to/dest');
 * ```
 */
export async function unzip(zipFilePath: string, targetDir: string) {
	const input = fs.createReadStream(zipFilePath);
	try {
		const extract = input.pipe(
			unzipper.Extract({
				path: targetDir,
			}),
		);

		await new Promise<void>((resolve, reject) => {
			// `.pipe()` は source のエラーを destination へ転送しないため、
			// input（zip ファイルが存在しない等）のエラーもここで捕捉しないと
			// unhandled 'error' イベントとしてプロセスごとクラッシュする
			input.on('error', reject);
			// unzipper の Extract は「全ファイルの書き込み完了」を 'close' で通知する。
			// 'finish' は入力（zip の読み取り）を消費し終えた時点で発火するため、
			// 'finish' で resolve すると展開途中のファイルが残ったまま完了扱いになる
			extract.on('close', () => resolve());
			extract.on('error', (err) => reject(err));
		});
	} finally {
		input.destroy();
	}
}

/**
 * zip アーカイブを展開せずに開き、エントリ一覧へアクセスできるオブジェクトを返す。
 * @param zipFilePath - 開く zip ファイルのパス
 * @example
 * ```ts
 * const directory = await extractZip('/path/to/archive.zip');
 * console.log(directory.files.map((file) => file.path));
 * ```
 */
export async function extractZip(zipFilePath: string) {
	const directory = await unzipper.Open.file(zipFilePath);
	return directory;
}
