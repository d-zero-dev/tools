import type { ProcessInitializer } from './types.js';

/**
 * Configuration options for the {@link Dealer} class.
 * @template T - The type of items being processed
 */
export interface DealerOptions<T = unknown> {
	/** Maximum number of concurrent workers (default: 10) */
	limit?: number;
	/** Filter function called when items are added via {@link Dealer.push}. Return `false` to reject the item. */
	onPush?: (item: T) => boolean;
}

/**
 * Manages parallel processing of items with configurable concurrency limits.
 *
 * Items are dispatched to workers up to the configured limit. When a worker
 * completes (successfully or with error), the next pending item is dispatched.
 * Errors are collected and accessible via the `errors` property.
 * @template T - The type of items to process, must extend WeakKey
 */
export class Dealer<T extends WeakKey> {
	#debug: (log: string) => void = () => {};
	#done = new WeakSet<T>();
	#doneCount = 0;
	#errors: { item: T; error: unknown }[] = [];
	#finish: () => void = () => {};
	#finished = false;
	#initializer: ProcessInitializer<T> | null = null;
	#items: T[];
	#limit: number;
	#nextIndex = 0;
	#onPush?: (item: T) => boolean;
	#pendingInitCount = 0;
	#progress: (progress: number, done: number, total: number, limit: number) => void =
		() => {};
	#starts = new WeakMap<T, () => Promise<void>>();
	#workers = new Set<T>();

	/**
	 * Errors collected from failed workers during processing.
	 * @returns Array of objects containing the failed item and its error
	 */
	get errors(): ReadonlyArray<{ item: T; error: unknown }> {
		return this.#errors;
	}

	/**
	 * @param items - Collection of items to process
	 * @param options - Configuration options
	 */
	constructor(items: readonly T[], options?: DealerOptions<T>) {
		this.#items = [...items];
		this.#limit = options?.limit ?? 10;
		this.#onPush = options?.onPush;
	}

	/**
	 * Sets a listener for debug log messages.
	 * @param listener - Callback invoked with debug log strings
	 */
	debug(listener: (log: string) => void) {
		this.#debug = listener;
	}

	/**
	 * Sets a listener called when all items have been processed (including failures).
	 * @param listener - Callback invoked on completion
	 */
	finish(listener: () => void) {
		this.#finish = listener;
	}

	/**
	 * Starts dispatching items to workers.
	 */
	play() {
		this.#deal();
	}

	/**
	 * Sets a listener for progress updates, called each time a worker completes.
	 * @param listener - Callback receiving progress ratio (0–1), done count (including errors), total count, and concurrency limit
	 */
	progress(
		listener: (progress: number, done: number, total: number, limit: number) => void,
	) {
		this.#progress = listener;
	}

	/**
	 * Adds items to the processing queue during execution.
	 * Added items are initialized using the same initializer set via {@link setup}.
	 * Calls after all processing has finished are silently ignored.
	 * @param items - Items to add. If `onPush` is configured, items returning `false` are skipped.
	 */
	async push(...items: T[]) {
		if (this.#finished) {
			return;
		}
		for (const item of items) {
			if (this.#onPush && !this.#onPush(item)) {
				continue;
			}
			this.#pendingInitCount++;
			await this.#initializeAndDispatch(item);
		}
	}

	/**
	 * Registers the initializer function and prepares all items for processing.
	 * Must be called before {@link play}.
	 * @param initializer - Function that receives each item and its index, returning a start function
	 */
	async setup(initializer: ProcessInitializer<T>) {
		this.#initializer = initializer;
		for (const item of this.#items) {
			const start = await initializer(item, this.#nextIndex++);
			this.#starts.set(item, async () => await start());
		}
		const total = this.#items.length;
		this.#progress(
			total === 0 ? 0 : this.#doneCount / total,
			this.#doneCount,
			total,
			this.#limit,
		);
	}

	#completeWorker(worker: T) {
		this.#workers.delete(worker);
		this.#done.add(worker);
		this.#doneCount++;
		this.#deal();
	}

	#deal() {
		const total = this.#items.length;
		this.#debug(`Done: ${this.#doneCount}/${total} (Limit: ${this.#limit})`);
		this.#progress(
			total === 0 ? 0 : this.#doneCount / total,
			this.#doneCount,
			total,
			this.#limit,
		);

		if (this.#doneCount === total && this.#pendingInitCount === 0) {
			this.#finished = true;
			this.#finish();
			return;
		}

		while (this.#workers.size < this.#limit) {
			const worker = this.#draw();
			if (!worker) {
				return;
			}

			this.#workers.add(worker);
			const start = this.#starts.get(worker);
			if (!start) {
				throw new Error(`Didn't have a starting function`);
			}

			void start()
				.then(() => {
					this.#completeWorker(worker);
				})
				.catch((error: unknown) => {
					this.#errors.push({ item: worker, error });
					this.#completeWorker(worker);
				});
		}
	}
	#draw() {
		for (const item of this.#items) {
			if (this.#done.has(item)) {
				continue;
			}
			if (this.#workers.has(item)) {
				continue;
			}
			return item;
		}
		return null;
	}
	async #initializeAndDispatch(item: T) {
		if (!this.#initializer) {
			throw new Error('setup() must be called before push()');
		}
		const start = await this.#initializer(item, this.#nextIndex++);
		this.#starts.set(item, async () => await start());
		this.#items.push(item);
		this.#pendingInitCount--;
		this.#deal();
	}
}
