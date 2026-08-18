import type {
	StepContext,
	StepFn,
	TaskListRunOptions,
	TaskListStepSnapshot,
	TaskState,
} from './types.js';

import { describeCause } from './describe-cause.js';
import { formatTaskLine } from './format-task-line.js';
import { Lanes } from './lanes.js';
import { TASK_LIST_ANIMATIONS } from './task-icons.js';
import { TaskListStepError } from './task-list-step-error.js';

const DEFAULT_ELAPSED_INTERVAL_MS = 250;

/**
 * パイプライン内部専用の、型消去済みステップ表現。
 * @internal
 */
interface StepRecord {
	readonly name: string;
	readonly fn: (input: unknown, ctx: StepContext<unknown>) => unknown | Promise<unknown>;
	/**
	 * `Lanes.update()` の `id` として使う、生成時点で確定する固有の識別子。
	 * 配列内の物理的な位置（`insertNext` による動的挿入で変化する）とは独立しており、
	 * 常に正しい表示順を保つ。初期ステップは整数、`insertNext` による挿入分は
	 * 前後の `laneId` の中間値を割る。
	 */
	readonly laneId: number;
	state: TaskState;
	message: string;
}

/**
 * `TaskList.pipe()` / `TaskList.from()` から構築される、型安全なステップ連結パイプライン。
 *
 * `.pipe()` を呼ぶたびに新しいインスタンスを返すイミュータブルなビルダーであり、
 * 型パラメータ `T` は「このパイプラインを `run()` した際に解決される値の型」を表す。
 * 直接 `new` せず `TaskList.pipe()` / `TaskList.from()` を起点にすること。
 * @template T - `run()` が解決する値の型
 * @example
 * ```ts
 * const id = await TaskList.pipe('fetch', async () => fetchUser(userId))
 *   .pipe('normalize', (user) => normalizeUser(user))
 *   .pipe('save', async (user, ctx) => {
 *     ctx.progress('writing to db...');
 *     await db.save(user);
 *     return user.id;
 *   })
 *   .run();
 * ```
 */
export class TaskListPipeline<T> {
	#hasRun = false;
	readonly #initial: unknown;
	#running = false;
	readonly #steps: StepRecord[];

	/**
	 * 実行前・実行中を問わず取得できる、現時点のステップ一覧のスナップショット。
	 * `run()` 前は全件 `pending` / `message: ''` で返る。
	 */
	get steps(): readonly TaskListStepSnapshot[] {
		return this.#steps.map(toSnapshot);
	}

	/**
	 * `TaskList.pipe()` / `TaskList.from()` / 既存パイプラインの `.pipe()` 以外から
	 * 呼び出さないこと。
	 * @param steps
	 * @param initial
	 * @internal
	 */
	constructor(steps: readonly StepRecord[], initial?: unknown) {
		// 各 StepRecord を clone する。配列の浅コピーだけだとレコード自体が旧インスタンスと
		// 共有され、run() の state/message 書き換えが分岐元パイプラインの表示状態を汚染する。
		this.#steps = steps.map((step) => ({ ...step }));
		this.#initial = initial;
	}

	/**
	 * 直前ステップの出力 `T` を受け取り `R` へ変換する新しいステップを連結する。
	 * 呼び出し元のインスタンスは変更されず、新しい `TaskListPipeline<R>` を返す。
	 * @param name - TUI に表示するタスク名
	 * @param fn - 直前の出力を受け取り、変換後の値を返すステップ関数
	 * @returns 型が `R` に更新された新しいパイプライン
	 */
	pipe<R>(name: string, fn: StepFn<T, R>): TaskListPipeline<R> {
		const nextStep: StepRecord = {
			name,
			fn: fn as StepRecord['fn'],
			laneId: this.#steps.length,
			state: 'pending',
			message: '',
		};
		return new TaskListPipeline<R>([...this.#steps, nextStep], this.#initial);
	}

	/**
	 * 先頭から順にステップを実行し、`Lanes` を使ってターミナルに複数行の状態リストを
	 * 描画する。いずれかのステップが例外を投げた場合は即座に停止し、後続ステップは
	 * 実行されない（残りは `pending` のまま確定する）。
	 *
	 * 同一インスタンスに対しては1回しか呼び出せない（成功・失敗を問わない）。
	 * `state`/`message` を直接書き換え、`insertNext` が `#steps` を永続的に
	 * 成長させるため、2回目の呼び出しは以前の実行で挿入されたステップの重複実行を
	 * 引き起こす。再実行したい場合は `TaskList.pipe()` / `.pipe()` から新しい
	 * パイプラインを構築すること。
	 * @param options - 描画・出力先の設定
	 * @returns 最終ステップの出力で解決される Promise。失敗時は {@link TaskListStepError} で reject する
	 */
	async run(options?: TaskListRunOptions): Promise<T> {
		if (this.#running) {
			throw new Error('TaskListPipeline.run() is already in progress on this instance.');
		}
		if (this.#hasRun) {
			throw new Error(
				'TaskListPipeline.run() has already completed on this instance. Build a fresh pipeline via TaskList.pipe()/.pipe() to run again.',
			);
		}
		this.#running = true;
		this.#hasRun = true;

		try {
			return await this.#run(options);
		} finally {
			this.#running = false;
		}
	}

	async #run(options?: TaskListRunOptions): Promise<T> {
		const verbose = options?.verbose ?? false;
		// verbose モードでは Lanes.update() が上書きではなく毎回1行追記になるため、
		// 経過時間タイマーによる高頻度の再描画はログ洪水になる。常に無効化する。
		const showElapsed = (options?.showElapsed ?? true) && !verbose;
		const elapsedIntervalMs = options?.elapsedIntervalMs ?? DEFAULT_ELAPSED_INTERVAL_MS;

		using lanes = new Lanes({
			stream: options?.stream,
			verbose,
			animations: TASK_LIST_ANIMATIONS,
		});

		for (const step of this.#steps) {
			lanes.update(step.laneId, formatTaskLine('pending', step.name, ''));
		}

		let value: unknown = this.#initial;
		let index = 0;

		while (index < this.#steps.length) {
			const step = this.#steps[index]!;
			step.state = 'running';
			step.message = '';

			const startedAt = Date.now();
			const render = () => {
				const elapsedMs = showElapsed ? Date.now() - startedAt : undefined;
				lanes.update(
					step.laneId,
					formatTaskLine('running', step.name, step.message, elapsedMs),
				);
			};
			render();

			const timer = showElapsed ? setInterval(render, elapsedIntervalMs) : null;

			// insertNext を同一ステップ中に複数回呼んだ場合、呼び出し順（a→b）で実行される
			// ように、直前に挿入したステップの位置を追い続ける（常に index+1 に挿入すると
			// 後着ちの呼び出しが先着ちより前に来てしまう）。
			let insertCursor = index;
			const ctx: StepContext<unknown> = {
				progress: (message) => {
					if (step.state !== 'running') {
						return;
					}
					step.message = message;
					render();
				},
				insertNext: (name, fn) => {
					if (step.state !== 'running') {
						return;
					}
					const prevLaneId = this.#steps[insertCursor]!.laneId;
					const nextLaneId = this.#steps[insertCursor + 1]?.laneId;
					const laneId =
						nextLaneId == null ? prevLaneId + 1 : (prevLaneId + nextLaneId) / 2;
					this.#steps.splice(insertCursor + 1, 0, {
						name,
						fn: fn as StepRecord['fn'],
						laneId,
						state: 'pending',
						message: '',
					});
					lanes.update(laneId, formatTaskLine('pending', name, ''));
					insertCursor++;
				},
			};

			try {
				value = await step.fn(value, ctx);
			} catch (error_) {
				if (timer) {
					clearInterval(timer);
				}
				const error = new TaskListStepError(step.name, index, error_);
				step.state = 'error';
				step.message = error.message;
				lanes.update(
					step.laneId,
					formatTaskLine('error', step.name, describeCause(error_)),
				);
				throw error;
			}

			if (timer) {
				clearInterval(timer);
			}
			step.state = 'done';
			lanes.update(step.laneId, formatTaskLine('done', step.name, step.message));
			index++;
		}

		return value as T;
	}
}

/**
 * @param step
 */
function toSnapshot(step: StepRecord): TaskListStepSnapshot {
	return { name: step.name, state: step.state, message: step.message };
}
