import type { TaskState } from './types.js';

import { formatElapsed } from './format-elapsed.js';
import { ICON } from './task-icons.js';

/**
 * `TaskListPipeline` の1行を `[状態アイコン] タスク名: 進捗メッセージ (経過時間)` の
 * 形式に整形する。`message` が空文字の場合はコロン以降を省略する。
 * @param state - タスクの実行状態
 * @param name - タスク名
 * @param message - 進捗メッセージ（未設定なら空文字）
 * @param elapsedMs - 経過時間（ミリ秒）。指定時のみ行末に付与する
 * @returns 整形済みの1行分の文字列
 */
export function formatTaskLine(
	state: TaskState,
	name: string,
	message: string,
	elapsedMs?: number,
): string {
	const label = message ? `${name}: ${message}` : name;
	const elapsed = elapsedMs == null ? '' : ` ${formatElapsed(elapsedMs)}`;
	return `${ICON[state]} ${label}${elapsed}`;
}
