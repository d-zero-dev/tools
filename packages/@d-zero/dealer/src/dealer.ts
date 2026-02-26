import type { ProcessInitializer } from './types.js';

export interface DealerOptions<T = unknown> {
	limit?: number;
	onPush?: (item: T) => boolean;
}

export class Dealer<T extends WeakKey> {
	#debug: (log: string) => void = () => {};
	#done = new WeakSet<T>();
	#doneCount = 0;
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

	constructor(items: readonly T[], options?: DealerOptions<T>) {
		this.#items = [...items];
		this.#limit = options?.limit ?? 10;
		this.#onPush = options?.onPush;
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
