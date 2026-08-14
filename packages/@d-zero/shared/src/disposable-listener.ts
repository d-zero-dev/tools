/**
 * `on` / `off` の 2 メソッドを持つイベント発行元の構造型。
 * Node.js の `EventEmitter` と puppeteer の `Page` / `Browser` の
 * どちらも構造的にこの型を満たす。
 * @template E - イベント名の型
 * @template A - リスナーに渡される引数のタプル型
 */
export type ListenerTarget<E extends string, A extends unknown[]> = {
	off(event: E, listener: (...args: A) => void): unknown;
	on(event: E, listener: (...args: A) => void): unknown;
};

/**
 * イベントリスナーを登録し、`using` 宣言のスコープ脱出時に自動で解除する
 * `Disposable` を返す。
 *
 * `page.on(...)` / `emitter.on(...)` の登録と解除を一箇所にまとめ、
 * 例外発生時の解除漏れを防ぐために使用する。Node 標準の `EventEmitter` と
 * puppeteer の `Page` / `Browser` のどちらにも使える。
 * @template E - イベント名の型
 * @template A - リスナーに渡される引数のタプル型
 * @param target - `on`/`off` を持つイベント発行元（`EventEmitter` や puppeteer の `Page` など）
 * @param event - 購読するイベント名
 * @param listener - イベント発生時に呼ばれるコールバック
 * @returns スコープ脱出時に `off` を呼び出す `Disposable`
 * @example
 * ```ts
 * {
 *   using _sub = disposableListener(page, 'console', (msg) => console.log(msg.text()));
 *   await page.goto(url);
 * } // スコープ脱出時に自動で page.off('console', ...) が呼ばれる
 * ```
 */
export function disposableListener<E extends string, A extends unknown[]>(
	// NoInfer がないと E/A が target 側（例: puppeteer の Page#on の generic
	// シグネチャ）からも推論されて E が `string` に広がり、Page などの型付き
	// エミッタで型エラーになる。event と listener だけから推論させることで、
	// Node 標準 EventEmitter と puppeteer の Page/Browser の両方に適合する。
	target: NoInfer<ListenerTarget<E, A>>,
	event: E,
	listener: (...args: A) => void,
): Disposable {
	target.on(event, listener);

	return {
		[Symbol.dispose]() {
			target.off(event, listener);
		},
	};
}
