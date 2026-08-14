/**
 * `SuppressedError`（`using` / `await using` のスコープ内で本体の例外と
 * dispose 処理の例外が同時に発生した際に投げられる）を再帰的に分解し、
 * すべての根本原因を配列で返す。
 *
 * `SuppressedError.message` は定型文（例: "An error was suppressed during
 * disposal."）のみで本体側の実際のエラー内容を隠してしまうため、
 * CLI のエラー表示ではこの関数で分解してから出力する。
 * @param error - 捕捉した例外（`SuppressedError` かどうかは問わない）
 * @returns 根本原因のエラーを列挙した配列（`SuppressedError` でなければ `[error]` を返す）
 * @example
 * ```ts
 * try {
 *   await run();
 * } catch (error) {
 *   for (const cause of unwrapSuppressedError(error)) {
 *     console.error('Error:', cause instanceof Error ? cause.message : cause);
 *   }
 * }
 * ```
 */
export function unwrapSuppressedError(error: unknown): unknown[] {
	if (error instanceof SuppressedError) {
		return [
			...unwrapSuppressedError(error.error),
			...unwrapSuppressedError(error.suppressed),
		];
	}

	return [error];
}
