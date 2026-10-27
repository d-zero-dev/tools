import type { GaxiosError } from 'gaxios';

/**
 * `GaxiosError` が自身に付ける目印のシンボル。
 *
 * gaxios の `GAXIOS_ERROR_SYMBOL`（`src/common.ts`）が `Symbol.for(`${pkg.name}-gaxios-error`)`
 * で作り、`GaxiosError` のコンストラクタがインスタンスフィールドとして付ける。
 * `Symbol.for` はグローバルレジストリを使うため、この仕組みを持つ版の gaxios が作った
 * エラーは、版によらず同じシンボルを持つ。`GAXIOS_ERROR_SYMBOL` は gaxios の公開 API
 * ではないので、こちらで同じキーのシンボルを引く。gaxios の更新でキーが変わると
 * 別の版のエラーを拾えなくなるため、`is-gaxios-error.spec.ts` が実際の `GaxiosError`
 * インスタンスがこのキーを持つことを確かめている（落ちたらここのキーを追う）。
 */
const GAXIOS_ERROR_SYMBOL = Symbol.for('gaxios-gaxios-error');

/**
 * 値が `GaxiosError` かどうかを、gaxios の版によらず判定する。
 *
 * `error instanceof GaxiosError` を使わないのは、依存の重複で版が食い違うと `false`
 * になるため。gaxios の `GaxiosError[Symbol.hasInstance]` は目印のシンボルの値が
 * 自分の版と**完全一致**したときだけ `true` にし、それ以外は通常のプロトタイプ判定に
 * 落ちる。このパッケージの `gaxios` と、実際にリクエストを投げる `google-auth-library`
 * や `googleapis-common` が持つ `gaxios` は、利用側の依存解決しだいで別の版になる
 * ため、レート制限（429）のエラーが `GaxiosError` と判定されず、リトライされないまま
 * throw されていた。
 *
 * 目印のシンボルを持つ `Error` を `GaxiosError` とみなし、値（版）は見ない。目印の
 * 仕組みを持たない古い版の gaxios が作ったエラーは判定できず `false` になる。
 * @example
 * ```ts
 * try {
 *   await sheets.batchUpdate(...);
 * } catch (error) {
 *   if (isGaxiosError(error)) {
 *     console.error(error.response?.status);
 *   }
 * }
 * ```
 * @param value - 判定対象
 */
export function isGaxiosError(value: unknown): value is GaxiosError {
	return value instanceof Error && GAXIOS_ERROR_SYMBOL in value;
}
