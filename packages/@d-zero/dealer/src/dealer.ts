import type { ProcessInitializer } from './types.js';

/**
 * {@link Dealer} のコンストラクタオプション。
 * @template T - 処理対象アイテムの型
 */
export interface DealerOptions<T = unknown> {
	/** 同時実行ワーカー数の上限。デフォルトは `10`。 */
	limit?: number;

	/**
	 * {@link Dealer.push} 時に呼ばれるフィルタ関数。
	 * `false` を返すとそのアイテムはキューに追加されない。
	 * @param item - push されたアイテム
	 * @returns アイテムを受け入れる場合は `true`
	 */
	onPush?: (item: T) => boolean;

	/**
	 * 処理のキャンセルに使用する `AbortSignal`。
	 * シグナルが abort されると新しいワーカーの起動を停止し、
	 * 実行中のワーカーの完了を待ってから終了する。
	 */
	signal?: AbortSignal;
}

/**
 * アイテムを並列処理するワーカープールマネージャー。
 *
 * 典型的な使用順序: {@link setup} → {@link finish} / {@link progress} → {@link play}。
 * 処理中に {@link push}（末尾へ追加）または {@link unshift}（先頭へ優先追加）で
 * 動的にアイテムを追加できる。
 * @template T - 処理対象アイテムの型（WeakKey 制約）
 */
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
	#signal?: AbortSignal;
	#starts = new WeakMap<T, () => Promise<void>>();
	#workers = new Set<T>();

	constructor(items: readonly T[], options?: DealerOptions<T>) {
		this.#items = [...items];
		this.#limit = options?.limit ?? 10;
		this.#onPush = options?.onPush;
		this.#signal = options?.signal;
	}

	/**
	 * デバッグログのリスナーを設定する。
	 * @param listener - デバッグメッセージを受け取るコールバック
	 */
	debug(listener: (log: string) => void) {
		this.#debug = listener;
	}

	/**
	 * 全アイテムの処理完了（またはキャンセル完了）時に呼ばれるリスナーを設定する。
	 * @param listener - 完了時に呼ばれるコールバック
	 */
	finish(listener: () => void) {
		this.#finish = listener;
	}

	/**
	 * 並列処理を開始する。
	 * {@link setup} を先に呼び出す必要がある。
	 */
	play() {
		this.#deal();
	}

	/**
	 * 進捗更新のリスナーを設定する。
	 * アイテムが完了するたびに呼び出される。
	 * @param listener - 進捗情報を受け取るコールバック
	 */
	progress(
		listener: (progress: number, done: number, total: number, limit: number) => void,
	) {
		this.#progress = listener;
	}

	/**
	 * 実行中にアイテムをキューに追加する。
	 * 追加されたアイテムには {@link setup} で設定した初期化関数が自動適用される。
	 * 処理完了後または signal が abort 済みの場合、呼び出しは無視される。
	 * @param items - 追加するアイテム
	 */
	async push(...items: T[]) {
		await this.#enqueue(items, false);
	}

	/**
	 * 各アイテムの初期化関数を設定する。
	 * {@link play} を呼ぶ前に必ず呼び出すこと。
	 * @param initializer - 各アイテムを初期化し、実行関数を返すコールバック
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

	/**
	 * 実行中にアイテムをキューの先頭へ追加する。
	 * {@link push} と異なり、まだ処理されていない既存アイテムよりも先に処理される。
	 * 引数の順序はそのまま保たれ（`unshift(a, b, c)` は a→b→c の順でディスパッチされ、
	 * index も同じ順序で採番される）、既存の未処理アイテムより前に挿入される。
	 * 追加されたアイテムには {@link setup} で設定した初期化関数が自動適用される。
	 * 処理完了後または signal が abort 済みの場合、呼び出しは無視される。
	 * @param items - 追加するアイテム
	 */
	async unshift(...items: T[]) {
		await this.#enqueue(items, true);
	}

	#deal() {
		if (this.#finished) {
			return;
		}
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

		if (this.#signal?.aborted) {
			if (this.#workers.size === 0) {
				this.#finished = true;
				this.#finish();
			}
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
	/**
	 * {@link push} / {@link unshift} 共通の追加処理。
	 * 各アイテムを引数順に初期化（index も引数順に採番）し、
	 * 受理されたアイテムをまとめてキューへ挿入してから一度だけディスパッチする。
	 * バッチを一括挿入することで、`prepend` 時に追加分が先頭へ連続して並ぶことを保証する。
	 * @param items - 追加するアイテム
	 * @param prepend - `true` ならキュー先頭へ、`false` なら末尾へ追加する
	 */
	async #enqueue(items: readonly T[], prepend: boolean) {
		if (this.#finished || this.#signal?.aborted) {
			return;
		}
		if (!this.#initializer) {
			throw new Error('setup() must be called before push()/unshift()');
		}

		const accepted: T[] = [];
		for (const item of items) {
			if (this.#onPush && !this.#onPush(item)) {
				continue;
			}
			this.#pendingInitCount++;
			const start = await this.#initializer(item, this.#nextIndex++);
			this.#pendingInitCount--;
			if (this.#signal?.aborted) {
				break;
			}
			this.#starts.set(item, async () => await start());
			accepted.push(item);
		}

		if (accepted.length === 0) {
			return;
		}

		if (prepend) {
			this.#items.unshift(...accepted);
		} else {
			this.#items.push(...accepted);
		}
		this.#deal();
	}
}
