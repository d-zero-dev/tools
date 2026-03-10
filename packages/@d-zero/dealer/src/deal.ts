import type { DealerOptions } from './dealer.js';
import type { LanesOptions } from './lanes.js';
import type { DelayOptions } from '@d-zero/shared/delay';

import { delay } from '@d-zero/shared/delay';

import { Dealer } from './dealer.js';
import { Lanes } from './lanes.js';

/**
 * Configuration options for the {@link deal} function.
 * Combines {@link DealerOptions} (concurrency), {@link LanesOptions} (display),
 * and deal-specific options (header, debug, interval).
 * @template T - The type of items being processed
 */
export type DealOptions<T = unknown> = DealerOptions<T> &
	LanesOptions & {
		/** Function to generate the progress header string */
		readonly header?: DealHeader;
		/** Whether to display debug log output */
		readonly debug?: boolean;
		/** Delay between each worker start, in milliseconds or as a DelayOptions object */
		readonly interval?: number | DelayOptions;
	};

/**
 * Function type that converts progress information into a header string for display.
 * @param progress - Progress ratio from 0 to 1
 * @param done - Number of processed items (including errors)
 * @param total - Total number of items
 * @param limit - Concurrency limit
 * @returns Header string to display. May include animation variables like `%earth%`, `%dots%`.
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
 * @template T - The type of items to process, must extend WeakKey
 * @param items - Collection of items to process
 * @param setup - Function that initializes each item and returns a start function.
 *   Receives the item, an update callback for logging, the item index,
 *   a setLineHeader callback for log prefixes, and a push callback to add items dynamically.
 *   Must return a start function that performs the actual work.
 * @param options - Configuration options including concurrency limit, interval delay, and display settings
 * @returns Promise that resolves when all items are processed successfully
 * @throws {AggregateError} When one or more workers throw errors. All workers run to
 *   completion regardless of individual failures. The AggregateError.errors array
 *   contains the original errors from each failed worker.
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
			try {
				await start();
			} finally {
				lanes.delete(index);
			}
		};
	});

	if (options?.debug) {
		dealer.debug((log) => {
			lanes.update(DEBUG_ID, `[DEBUG]: ${log}`);
		});
	}

	return new Promise<void>((resolve, reject) => {
		dealer.finish(() => {
			lanes.close();
			if (dealer.errors.length > 0) {
				reject(
					new AggregateError(
						dealer.errors.map((e) => e.error),
						`${dealer.errors.length} worker(s) failed`,
					),
				);
			} else {
				resolve();
			}
		});

		dealer.play();
	});
}
