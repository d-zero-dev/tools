/**
 * スプレッドシート ID から編集 URL を組み立てる。
 *
 * Drive API の `webViewLink` は `?usp=drivesdk` 等が付いて形が揺れるため使わず、
 * 常にこの形式に統一する。
 * @param id - スプレッドシート ID
 * @example
 * ```ts
 * buildSpreadsheetUrl('abc123');
 * //=> 'https://docs.google.com/spreadsheets/d/abc123/edit'
 * ```
 */
export function buildSpreadsheetUrl(id: string) {
	return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
