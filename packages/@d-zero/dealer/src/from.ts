import { TaskListPipeline } from './task-list-pipeline.js';

/**
 * 既知の初期値からパイプラインを開始する。{@link pipe} と異なり、この初期値は
 * TUI 上のタスク行として表示されない（最初のステップへの入力の種にすぎない）。
 * @template T - 初期値の型
 * @param value - 最初のステップに渡す初期値
 * @returns まだステップを持たない、型が `T` の新しいパイプライン
 * @example
 * ```ts
 * const pipeline = from(42).pipe('double', (n) => n * 2);
 * ```
 */
export function from<T>(value: T): TaskListPipeline<T> {
	return new TaskListPipeline<T>([], value);
}
