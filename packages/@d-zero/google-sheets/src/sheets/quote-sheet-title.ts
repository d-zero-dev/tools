/**
 * シート名を A1 表記のシート参照として単一引用符で囲む。
 *
 * Google Sheets の範囲指定では、シート名に含まれる `'` を `''` に重ねてから
 * 外側を単一引用符で囲む。この重ねをしないと、名前に `'` があるシートの
 * `getValues` / `getCellTypes` / `getRowMetadata` が壊れた範囲文字列を送る。
 *
 * `'` を含まない名前では `'${title}'` と同じ結果になる。
 * @example
 * ```ts
 * quoteSheetTitle('Report'); // "'Report'"
 * quoteSheetTitle("Year's End"); // "'Year''s End'"
 * ```
 * @param title - シートの `properties.title`
 * @returns A1 表記でシート名部分に使える引用済み文字列（`!` より前）
 */
export function quoteSheetTitle(title: string): string {
	return `'${title.replaceAll("'", "''")}'`;
}
