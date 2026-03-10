import type { DealerOptions } from './dealer.js';
import type { LanesOptions } from './lanes.js';
import type { DelayOptions } from '@d-zero/shared/delay';

import { delay } from '@d-zero/shared/delay';

import { Dealer } from './dealer.js';
import { Lanes } from './lanes.js';

/**
 * {@link deal} 関数のオプション。
 * {@link DealerOptions} と {@link LanesOptions} を合成し、
 * ヘッダー・デバッグ・インターバルの設定を追加したもの。
 * @template T - 処理対象アイテムの型
 */
export type DealOptions<T = unknown> = DealerOptions<T> &
	LanesOptions & {
		readonly header?: DealHeader;
		readonly debug?: boolean;
		readonly interval?: number | DelayOptions;
	};

/**
 * 進捗情報をヘッダー文字列に変換するコールバック型。
 * 返却文字列にはアニメーション変数（`%earth%`, `%dots%` など）を含めることができる。
 * @param progress - 進捗率（0〜1）
 * @param done - 完了したアイテム数
 * @param total - 総アイテム数
 * @param limit - 同時実行数制限
 * @returns ヘッダーとして表示する文字列
 */
export type DealHeader = (
	progress: number,
	done: number,
	total: number,
	limit: number,
) => string;

const DEBUG_ID = Number.MIN_SAFE_INTEGER;

/**
 * Processes items in parallel with coordinated logging and optional interval delays.
 *
 * ## Architecture
 *
 * ### Execution Flow
 * 1. `dealer.play()` initiates parallel processing
 * 2. For each worker:
 *    - `start()` function is called (item is started)
 *    - **Interval delay executes** (if `options.interval` is specified)
 *      - Wait log is output via `delay()` callback with `%countdown()` format
 *      - This happens **after** the item starts but **before** its first output
 *    - Actual processing begins (first `update()` call from user code)
 *
 * ### Interval Delay
 * - Interval delay is executed **inside** the `start()` function, not before it
 * - This ensures the item is started first, then waits before producing output
 * - Wait log is automatically displayed using `%countdown()` format
 * - The delay duration is determined synchronously before the delay starts
 *
 * ### Line Header Management
 * - `setLineHeader()` allows setting a prefix string for all log lines of an item
 * - Once set, all subsequent `update()` calls automatically prepend the line header
 * - This enables consistent formatting across multiple log updates
 *
 * ### Wait Logging
 * - All wait logs (including interval delay) are output via `delay()` callback
 * - This ensures the determined interval (even for random delays) is used for countdown
 * - The `%countdown()` function displays remaining time based on the actual delay duration
 *
 * ### Cancellation via AbortSignal
 * - Pass `signal` option with an `AbortSignal` to enable cancellation
 * - When the signal is aborted:
 *   1. No new workers will be launched
 *   2. Currently running workers will continue until they complete
 *   3. `push()` calls after abort are silently ignored
 *   4. The returned Promise resolves after all running workers finish
 * - If the signal is already aborted before `play()`, the Promise resolves immediately
 *   without processing any items
 * @template T - 処理対象アイテムの型（WeakKey 制約）
 * @param items - 処理対象のアイテムのコレクション
 * @param setup - 各アイテムを初期化し、開始関数を返すコールバック
 * @param options - 並列処理・ログ出力・インターバルの設定オプション
 * @returns 全アイテムの処理完了またはキャンセル完了時に解決する Promise
 */
export async function deal<T extends WeakKey>(
	items: readonly T[],
	setup: (
		process: T,
		update: (log: string) => void,
		index: number,
		setLineHeader: (lineHeader: string) => void,
		push: (...items: T[]) => Promise<void>,
	) => Promise<() => void | Promise<void>> | (() => void | Promise<void>),
	options?: DealOptions<T>,
) {
	const dealer = new Dealer(items, options);
	const lanes = new Lanes(options);

	if (options?.header) {
		dealer.progress((progress, done, total, limit) => {
			lanes.header(options.header!(progress, done, total, limit));
		});
	}

	await dealer.setup(async (process, index) => {
		let lineHeader = '';
		const setLineHeader = (header: string) => {
			lineHeader = header;
		};
		const update = (log: string) => lanes.update(index, lineHeader + log);
		const push = (...newItems: T[]) => dealer.push(...newItems);
		const start = await setup(process, update, index, setLineHeader, push);
		return async () => {
			await delay(options?.interval ?? 0, (determinedInterval) => {
				update(
					`Waiting interval: %countdown(${determinedInterval},${index}_interval)%ms`,
				);
			});
			await start();
			lanes.delete(index);
		};
	});

	if (options?.debug) {
		dealer.debug((log) => {
			lanes.update(DEBUG_ID, `[DEBUG]: ${log}`);
		});
	}

	return new Promise<void>((resolve) => {
		dealer.finish(() => {
			lanes.close();
			resolve();
		});

		dealer.play();
	});
}
