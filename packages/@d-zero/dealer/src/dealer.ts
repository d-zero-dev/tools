import type { ProcessInitializer } from './types.js';

export interface DealerOptions {
	limit?: number;
}

export class Dealer<T extends WeakKey> {
	#done = new WeakSet<T>();
	#doneCount = 0;
	#items: readonly T[];
	#limit: number;
	#starts = new WeakMap<T, () => Promise<void>>();
	#workers = new Set<T>();
	#debug: (log: string) => void = () => {};
	#finish: () => void = () => {};
	#progress: (progress: number, done: number, total: number, limit: number) => void =
		() => {};

	constructor(items: readonly T[], options?: DealerOptions) {
		this.#items = items;
		this.#limit = options?.limit ?? 10;
	}

	debug(listener: (log: string) => void) {
		this.#debug = listener;
	}

	finish(listener: () => void) {
		this.#finish = listener;
	}

	play() {
		this.#deal();
	}

	progress(
		listener: (progress: number, done: number, total: number, limit: number) => void,
	) {
		this.#progress = listener;
	}

	async setup(initializer: ProcessInitializer<T>) {
		for (const [index, item] of this.#items.entries()) {
			const start = await initializer(item, index);
			this.#starts.set(item, async () => await start());
		}
		this.#progress(
			this.#doneCount / this.#items.length,
			this.#doneCount,
			this.#items.length,
			this.#limit,
		);
	}

	#deal() {
		this.#debug(`Done: ${this.#doneCount}/${this.#items.length} (Limit: ${this.#limit})`);
		this.#progress(
			this.#doneCount / this.#items.length,
			this.#doneCount,
			this.#items.length,
			this.#limit,
		);

		if (this.#doneCount === this.#items.length) {
			this.#finish();
		}

		while (this.#workers.size <= this.#limit) {
			const worker = this.#draw();
			if (!worker) {
				return;
			}

			this.#workers.add(worker);
			const start = this.#starts.get(worker);
			if (!start) {
				throw new Error(`Didn't have a starting function`);
			}
			void start().then(() => {
				this.#workers.delete(worker);
				this.#done.add(worker);
				this.#doneCount++;
				this.#deal();
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
}
