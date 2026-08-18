const MS_PER_SECOND = 1000;

/**
 * 経過時間をタスク行の末尾に表示する形式（例: `(3.4s)`）に変換する。
 * @param elapsedMs - 経過時間（ミリ秒）
 * @returns `(<秒数>s)` 形式の文字列
 */
export function formatElapsed(elapsedMs: number): string {
	const seconds = elapsedMs / MS_PER_SECOND;
	return `(${seconds.toFixed(1)}s)`;
}
