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
