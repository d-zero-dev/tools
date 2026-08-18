/**
 * 例外・スロー値（`unknown`）を1行の説明文に変換する。`Error` インスタンスなら
 * `message` を、それ以外は `String()` による文字列表現を返す。
 * {@link TaskListStepError} のメッセージ生成と、`TaskListPipeline.run` 実行中の
 * エラー行表示の両方で、同じ説明文を使うために共有する。
 * @param cause - 説明文に変換する値
 * @returns 1行の説明文
 * @example
 * ```ts
 * describeCause(new Error('boom')); // 'boom'
 * describeCause('boom'); // 'boom'
 * ```
 */
export function describeCause(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
