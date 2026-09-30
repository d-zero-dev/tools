import type { OAuth2Client } from 'google-auth-library';

import { google } from 'googleapis';

import { log } from './debug.js';
import { buildSpreadsheetUrl } from './sheets/build-spreadsheet-url.js';
import { parseGoogleUrl } from './sheets/parse-google-url.js';

const createLog = log.extend('createSpreadsheet');

/**
 * Drive フォルダの URL を指定して、そのフォルダ内にスプレッドシートを新規作成する。
 *
 * - 必要な OAuth scope は `https://www.googleapis.com/auth/drive.file`（または
 *   `https://www.googleapis.com/auth/drive`）。`spreadsheets` scope だけではフォルダに配置できない。
 *   作成後に `new Sheets(url, auth)` へ同じ `auth` を使い回すなら両 scope を含めて取得する
 * - 同名ファイルの検索・再利用はしない。呼ぶたびに新規作成する
 * - **リトライしない（Why not）**: `files.create` は非冪等で、タイムアウト後にリトライすると
 *   同名ファイルが二重に作られ得る。失敗時はそのまま throw し、再実行の判断は呼び出し側に委ねる
 * @param folderUrl - 作成先の Drive フォルダ URL（`parseGoogleUrl` が `drive-folder` と判別するもの）
 * @param title - スプレッドシートのファイル名
 * @param auth - Drive scope を含む認証済みクライアント
 * @returns 作成したスプレッドシートの ID と編集 URL
 * @throws {URIError} `folderUrl` が Drive フォルダ URL でない場合（API は呼ばない）
 * @example
 * ```ts
 * import { authentication } from '@d-zero/google-auth';
 * import { createSpreadsheet, Sheets } from '@d-zero/google-sheets';
 *
 * const auth = await authentication(null, [
 *   'https://www.googleapis.com/auth/spreadsheets',
 *   'https://www.googleapis.com/auth/drive.file',
 * ]);
 * const { id, url } = await createSpreadsheet(
 *   'https://drive.google.com/drive/folders/YOUR_FOLDER_ID',
 *   '集計結果',
 *   auth,
 * );
 * const sheets = new Sheets(url, auth);
 * ```
 */
export async function createSpreadsheet(
	folderUrl: string,
	title: string,
	auth: OAuth2Client,
): Promise<{ id: string; url: string }> {
	const target = parseGoogleUrl(folderUrl);
	if (target?.kind !== 'drive-folder') {
		throw new URIError(`The URL is not Drive folder URL: ${folderUrl}`);
	}

	createLog('Create "%s" in folder: %s', title, target.id);

	const drive = google.drive({ version: 'v3', auth });
	const res = await drive.files.create({
		requestBody: {
			name: title,
			mimeType: 'application/vnd.google-apps.spreadsheet',
			parents: [target.id],
		},
		supportsAllDrives: true,
		fields: 'id',
	});

	const id = res.data.id;
	if (!id) {
		throw new Error('Drive API response does not contain file id');
	}

	return { id, url: buildSpreadsheetUrl(id) };
}
