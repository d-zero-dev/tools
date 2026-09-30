/**
 * `parseGoogleUrl` が判別する Google URL の種別と ID。
 */
export type GoogleUrlTarget = {
	/** `drive-folder`: Drive のフォルダ / `spreadsheet`: Google スプレッドシート */
	readonly kind: 'drive-folder' | 'spreadsheet';
	readonly id: string;
};

const DRIVE_FOLDER_PATH = /^\/drive\/(?:u\/\d+\/)?folders\/([^/]+)/;
const SPREADSHEET_PATH = /^(?:\/a\/[^/]+)?\/spreadsheets\/(?:u\/\d+\/)?d\/([^/]+)/;

/**
 * Google の URL から、Drive フォルダかスプレッドシートかを判別して ID を取り出す。
 *
 * 受理するのは以下のみ。マイドライブ直下（`/drive/my-drive`）やファイル URL を
 * 誤って受理すると、呼び出し側が意図しない場所にファイルを作ってしまうため `null` を返す。
 * - `https://drive.google.com/drive/folders/<id>`（`/drive/u/N/folders/<id>`、クエリ付きも可）
 * - `https://docs.google.com/spreadsheets/d/<id>/...`（`/a/<domain>/` や `/u/N/` 付きも可）
 *
 * `https://drive.google.com/open?id=<id>` は意図的に受理しない（Why not）。フォルダとファイルが
 * 同一形式で URL だけでは種別を判別できず、スプレッドシートの共有リンクを
 * フォルダと誤判定して作成 API が失敗するため。
 * @param url - 判別対象の URL
 * @returns 種別と ID。受理対象外・URL として不正な場合は `null`
 * @example
 * ```ts
 * parseGoogleUrl('https://drive.google.com/drive/folders/abc123?usp=sharing');
 * //=> { kind: 'drive-folder', id: 'abc123' }
 * parseGoogleUrl('https://docs.google.com/spreadsheets/d/xyz789/edit#gid=0');
 * //=> { kind: 'spreadsheet', id: 'xyz789' }
 * parseGoogleUrl('https://drive.google.com/drive/my-drive');
 * //=> null
 * ```
 */
export function parseGoogleUrl(url: string): GoogleUrlTarget | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	if (parsed.hostname === 'drive.google.com') {
		const folderId = DRIVE_FOLDER_PATH.exec(parsed.pathname)?.[1];
		return folderId ? { kind: 'drive-folder', id: folderId } : null;
	}

	if (parsed.hostname === 'docs.google.com') {
		const spreadsheetId = SPREADSHEET_PATH.exec(parsed.pathname)?.[1];
		if (spreadsheetId) {
			return { kind: 'spreadsheet', id: spreadsheetId };
		}
	}

	return null;
}
