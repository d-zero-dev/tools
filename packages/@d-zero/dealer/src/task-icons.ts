import type { Animations } from './types.js';

import c from 'ansi-colors';

/**
 * `TaskListPipeline` の状態アイコン。`[`/`]` のブラケット自体は常に無色のまま固定し、
 * 中の記号だけを色付けする。色が無効な環境（`NO_COLOR`・非TTY）でも記号の形状自体で
 * 状態を判別できるようにするための意図的な制約。
 */
export const ICON = {
	pending: '[ ]',
	running: '[%taskSpin%]',
	done: `[${c.green('✔')}]`,
	error: `[${c.red('✘')}]`,
} as const;

/**
 * `Lanes`/`Display` の `animations` オプションに渡すスピナー定義。
 * 10フレームの braille スピナー。この fps はアニメーション単体の進行速度であり、
 * `LanesOptions.fps`（`Display` 全体の再描画間隔）とは独立している。
 */
export const TASK_LIST_ANIMATIONS: Animations = {
	taskSpin: [12, '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};
