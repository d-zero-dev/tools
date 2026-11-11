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
 *
 * Why `archive.abort()` on output failure / finally: 出力ストリームが error で
 * 落ちても archiver の directory 走査・`createReadStream` は止まらない。
 * Promise が reject したあとに呼び出し元がソースを消すと、遅延した open が
 * リスナー無しの ENOENT になりプロセスを落とす。abort は pending キューを止める
 * best-effort であり、稼働中 worker の読み取りは完了し得る（remaining sources は
 * drain しない）。それでも未処理キューを残さないために呼び、archive の `error`
 * も購読して aborted 状態での `finalize()` 由来の emit を uncaught にしない。
 * 成功後 finally の abort は finalized 済みなら no-op。
 *
 * 出力先が書けない場合の reject 理由は従来どおり
 * `Failed to save file "<output>" from "<target>"` で、元の stream エラーは
 * `Error.cause` に載せる。
 * @param outputfilePath - 出力する zip ファイルのパス
 * @param targetDir - アーカイブ対象のディレクトリ
 * @example
 * ```ts
 * await zip('/path/to/output.zip', '/path/to/dir');
 * ```
 */
export async function zip(outputfilePath: string, targetDir: string) {
	const output = fs.createWriteStream(outputfilePath);
	let archive: ZipArchive | undefined;
	try {
		archive = new ZipArchive();
		const active = archive;

		// directory()/finalize() より前にリスナーを付ける。出力先 error は非同期で
		// 発火し、未購読だと uncaught Exception になる。
		// 完了条件は以前の Promise.all([finalize(), written]) と同じく、
		// archive.finalize() と output の finish の両方が成功すること。
		await new Promise<void>((resolve, reject) => {
			let settled = false;
			let remaining = 2;
			let outputFailed = false;

			const succeedPartial = () => {
				if (settled) {
					return;
				}
				remaining -= 1;
				if (remaining === 0) {
					settled = true;
					resolve();
				}
			};

			const fail = (error: Error) => {
				if (settled) {
					return;
				}
				settled = true;
				// 呼び出し元が targetDir を消す前に未処理のソース読み取りを止める
				active.abort();
				reject(error);
			};

			output.on('finish', succeedPartial);
			output.on('error', (err) => {
				outputFailed = true;
				fail(
					new Error(`Failed to save file "${outputfilePath}" from "${targetDir}"`, {
						cause: err,
					}),
				);
			});
			// aborted 状態で finalize() すると ABORTED が emit + reject される。
			// 出力失敗が先ならメッセージ契約を優先し、archive 側は握りつぶす。
			active.on('error', (err) => {
				if (settled || outputFailed) {
					return;
				}
				fail(err instanceof Error ? err : new Error(String(err)));
			});

			active.pipe(output);
			active.directory(targetDir, false);

			void (async () => {
				try {
					await active.finalize();
					succeedPartial();
				} catch (error) {
					if (settled || outputFailed) {
						return;
					}
					fail(error instanceof Error ? error : new Error(String(error)));
				}
			})();
		});
	} finally {
		archive?.abort();
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
