import type { StepFn } from './types.js';

import { TaskListPipeline } from './task-list-pipeline.js';

/**
 * 新しいパイプラインを開始する。最初のステップは入力を受け取らない
 * （`fn` の入力型は常に `undefined`）。既知の初期値から始めたい場合は
 * {@link from} を使うこと。
 * @template R - 最初のステップの出力型
 * @param name - TUI に表示するタスク名
 * @param fn - 最初のステップの処理内容
 * @returns 型が `R` の新しいパイプライン
 * @example
 * ```ts
 * const pipeline = pipe('fetch', () => fetchUser(userId));
 * ```
 */
export function pipe<R>(name: string, fn: StepFn<undefined, R>): TaskListPipeline<R> {
	return new TaskListPipeline<undefined>([]).pipe(name, fn);
}
