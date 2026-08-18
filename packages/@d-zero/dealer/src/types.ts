/**
 * アニメーション定義のマップ。
 * キーはアニメーション名（`%name%` 形式でログ中に埋め込み可能）、
 * 値は先頭が FPS、残りがスプライトフレームのタプル。
 */
export type Animations = Record<string, [fps: number, ...sprites: string[]]>;

/**
 * サポートされるフレームレート。
 */
export type FPS = 12 | 24 | 30 | 60;

/**
 * 各アイテムを初期化し、実行関数を返すコールバック。
 * @template T - 処理対象アイテムの型
 * @param process - 初期化対象のアイテム
 * @param index - アイテムのインデックス（0始まり）
 * @returns 処理を開始する関数を返す Promise
 */
export interface ProcessInitializer<T> {
	(process: T, index: number): Promise<() => Promise<void> | void>;
}

/**
 * {@link TaskListPipeline} の各ステップの実行状態。
 * - `pending`: 未実行
 * - `running`: 実行中（{@link StepContext.progress} によるメッセージ更新を受け付ける）
 * - `done`: 正常終了
 * - `error`: 例外により終了（この状態になった時点でパイプライン全体が停止する）
 * @example
 * ```ts
 * const stillPending = pipeline.steps.filter((step) => step.state === 'pending');
 * ```
 */
export type TaskState = 'pending' | 'running' | 'done' | 'error';

/**
 * ステップ関数に渡される実行コンテキスト。
 * @template R - このステップ自身の出力型。{@link StepContext.insertNext} で挿入する
 * ステップは、直後の既存ステップが期待する入力型と同じ `R` でなければならない
 * （型が変わる割り込みは、直後の既存ステップの入力型が構築時に確定済みであるため
 * 静的に安全にできない。同一型限定のワークアラウンドとして提供する）。
 * @example
 * ```ts
 * TaskList.pipe('fetch page', async (_input, ctx) => {
 *   ctx.progress('downloading...');
 *   const page = await fetchPage();
 *   if (page.hasNext) {
 *     // 同じ型（Page）を受け取り Page を返すステップだけ割り込み挿入できる
 *     ctx.insertNext('fetch next page', (prev) => fetchPage(prev.nextUrl));
 *   }
 *   return page;
 * });
 * ```
 */
export interface StepContext<R> {
	/**
	 * 実行中の進捗メッセージを更新する。
	 * 同期・戻り値なし・例外を投げない契約。ステップが `done`/`error` に確定した後の
	 * 呼び出しは無視される。
	 * @param message - 表示する進捗メッセージ
	 */
	progress(message: string): void;
	/**
	 * 現在のステップの直後に、同じ型 `R` を受け取り `R` を返すステップを実行時に
	 * 割り込み挿入する。挿入されたステップは元々直後に控えていたステップより先に
	 * 実行される。同一ステップ中に複数回呼んだ場合は呼び出し順に実行される
	 * （2回目以降は直前に挿入したステップの直後に挿入する）。
	 * @param name - TUI に表示するタスク名
	 * @param fn - 割り込み挿入するステップの処理内容
	 */
	insertNext(name: string, fn: StepFn<R, R>): void;
}

/**
 * {@link TaskListPipeline} の1ステップを表す関数。同期・非同期どちらでもよい。
 * variance 注釈（`in`/`out`）は付けない。{@link StepContext} が
 * `insertNext(fn: StepFn<R, R>)` を持つため `R` は不変（invariant）であり、
 * `out R` と宣言するとコンパイラに拒否される。
 * @template T - 直前のステップの出力型（このステップの入力）
 * @template R - このステップの出力型
 * @example
 * ```ts
 * const double: StepFn<number, number> = (n) => n * 2;
 * ```
 */
export type StepFn<T, R> = (input: T, ctx: StepContext<R>) => R | Promise<R>;

/**
 * 実行前・実行中を問わず取得できる、ステップ1件分の型消去済みスナップショット。
 * @example
 * ```ts
 * const stillPending = pipeline.steps.filter((step) => step.state === 'pending');
 * console.log(stillPending.map((step) => step.name));
 * ```
 */
export interface TaskListStepSnapshot {
	readonly name: string;
	readonly state: TaskState;
	readonly message: string;
}

/**
 * {@link TaskListPipeline.run} のオプション。
 * @example
 * ```ts
 * // CI ログ向け: stderr へ追記出力し、経過時間タイマーは無効化する
 * await pipeline.run({ stream: process.stderr, verbose: true, showElapsed: false });
 * ```
 */
export interface TaskListRunOptions {
	/**
	 * 出力先ストリーム。省略時は `process.stdout`。
	 */
	readonly stream?: NodeJS.WritableStream;
	/** verbose モードでは上書き表示ではなく追記出力を行う。 */
	readonly verbose?: boolean;
	/** 実行中のステップの経過時間を行末に表示するか。既定は `true`。 */
	readonly showElapsed?: boolean;
	/** 経過時間の再描画間隔（ミリ秒）。既定は `250`。 */
	readonly elapsedIntervalMs?: number;
}
