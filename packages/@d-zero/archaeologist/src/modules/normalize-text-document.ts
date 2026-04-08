/**
 * テキストを正規化する（連続空白を改行に変換、句点で改行、連続改行を単一改行に統合）
 * @param text - 正規化対象のテキスト
 * @returns 正規化されたテキスト
 */
export function normalizeTextDocument(text: string) {
	return (
		text
			.trim()
			// Spaces
			.replaceAll(/\s+/g, '\n')
			// Periods
			.replaceAll('。', '。\n')
			// Newlines
			.replaceAll(/\n+/g, '\n')
			.trim()
	);
}
