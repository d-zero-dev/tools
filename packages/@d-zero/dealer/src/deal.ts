import type { DealerOptions } from './dealer.js';
import type { LanesOptions } from './lanes.js';
import type { DelayOptions } from '@d-zero/shared/delay';

import { delay } from '@d-zero/shared/delay';

import { Dealer } from './dealer.js';
import { Lanes } from './lanes.js';

export type DealOptions = DealerOptions &
	LanesOptions & {
		readonly header?: DealHeader;
		readonly debug?: boolean;
		readonly interval?: number | DelayOptions;
	};

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
 * @param items - Collection of items to process
 * @param setup - Function that initializes each item and returns a start function
 * @param options - Configuration options including interval delay
 * @returns Promise that resolves when all items are processed
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
	options?: DealOptions,
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
