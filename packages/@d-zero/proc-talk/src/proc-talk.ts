/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChildProcess, fork } from 'node:child_process';

import { Deferred } from '@d-zero/shared/deferred';

import { log } from './debug.js';
import { deserialize } from './deserialize.js';
import { serialize } from './serialize.js';

export type ProcTalkConfig<T, O = void> =
	| {
			type: 'main';
			subModulePath: string;
			options?: O;
	  }
	| {
			type: 'child';
			title?: string;
			process: (
				this: ProcTalk<T, O>,
				options?: O,
			) => ChildProcCleanup | Promise<ChildProcCleanup> | void;
	  };

export type ChildProcCleanup = () => void | Promise<void>;

export class ProcTalk<T, O = void> {
	readonly #callLog: typeof log;
	#cleanup: ChildProcCleanup | null = null;
	#closePromise: Promise<void> | null = null;
	readonly #id: number;
	readonly #initialized = new Deferred<void>();
	readonly #initLog: typeof log;
	readonly #listeners = new Map<string, unknown>();
	readonly #log: typeof log;
	readonly #process: ChildProcess | NodeJS.Process;
	readonly #returnListeners = new Map<string, unknown>();

	readonly #type: 'main' | 'child';

	get pid() {
		return this.#id;
	}

	constructor(config: ProcTalkConfig<T, O>) {
		this.#type = config.type;

		if (config.type === 'main') {
			this.#process = fork(config.subModulePath, [JSON.stringify(config.options ?? {})]);
		} else {
			this.#process = process;
			this.#process.title = `${config.title ?? '@d-zero/proc-talk'}:child-process`;
		}

		this.#id = this.#process.pid ?? -1;

		this.#log = log.extend(`${this.#type}:${this.#id}`);
		this.#initLog = this.#log.extend('init');
		this.#callLog = this.#log.extend('call');

		void this.#init(config);
	}

	/**
	 * `await using` 宣言のスコープ脱出時に呼ばれ、{@link ProcTalk.close} と同じ解放処理を行う。
	 * @example
	 * ```ts
	 * {
	 *   await using talk = new ProcTalk({ type: 'main', subModulePath });
	 *   await talk.call('doSomething');
	 * } // スコープ脱出時に自動で子プロセスへ :kill が送られ、exit を待つ
	 * ```
	 */
	async [Symbol.asyncDispose]() {
		await this.#close();
	}
	bind<P extends keyof T>(type: P, listener: T[P]) {
		this.#log('bind:%s', type);
		this.#listeners.set(type.toString(), listener);
	}

	call<
		P extends keyof T,
		R = T[P] extends (...args: any) => any ? ReturnType<T[P]> : unknown,
	>(
		type: P,
		...payload: T[P] extends (...args: any) => any ? Parameters<T[P]> : unknown[]
	): Promise<R> {
		const callPromise = new Promise<R>((resolve) => {
			const typeName = type.toString();
			this.#callLog('▶️ call(%o, %O)', typeName, payload);

			const listener: (args?: {
				type?: P;
				returns?: T[P] extends (...args: any) => any ? ReturnType<T[P]>[] : never;
			}) => void = (args) => {
				this.#log('◀️ returnListener(%o)', args);
				if (args?.type?.toString() === typeName && args.returns) {
					this.#log('▶️ %s.resolve(%o)', typeName, args.returns[0]);
					resolve(args.returns[0] as R);
					this.#log('%s.callPromise: %o', typeName, callPromise);
				}
			};

			// @ts-ignore
			payload = serialize(payload, this.#log);

			this.#returnListeners.set(typeName, listener);
			this.#callLog('▶️ send(%o, %O)', typeName, payload);
			this.#process.send?.({
				type,
				payload,
			});
		});
		return callPromise;
	}

	/**
	 * 子プロセスに `:kill` を送信し、`exit` するまで待機する。複数回呼び出しても
	 * 同じ Promise を返すため安全（冪等）。
	 * @deprecated `await using` 宣言（`Symbol.asyncDispose`）による自動解放を使用すること。
	 * スコープと解放タイミングが一致しない場合のみ直接呼び出す。
	 * @returns 子プロセスが終了したら解決する Promise
	 */
	close() {
		return this.#close();
	}

	async initialized(): Promise<void> {
		this.#initLog('await');
		await this.#initialized.promise();
		this.#initLog('done');
	}
	log(...args: Parameters<typeof log>) {
		this.#log(...args);
	}
	#close() {
		if (this.#type !== 'main' || !(this.#process instanceof ChildProcess)) {
			return Promise.resolve();
		}

		const proc = this.#process;

		// 2 回目以降の呼び出しは同じ Promise を返すことで冪等にする。
		// ガードがないと、既に exit 済みのプロセスへ再度 once('exit', ...) を
		// 張ってしまい、exit イベントが二度と発火せず Promise が永久に pending になる。
		this.#closePromise ??= new Promise<void>((resolve) => {
			if (proc.exitCode !== null || proc.signalCode !== null) {
				resolve();
				return;
			}

			proc.once('exit', () => {
				resolve();
			});

			if (!proc.connected) {
				// IPC チャネルが既に閉じている: :kill は届かないので直接シグナルで止める
				proc.kill();
				return;
			}

			// コールバック形式で送る理由:
			// 1. コールバックなしだと、送信失敗時（ERR_IPC_CHANNEL_CLOSED 等）に
			//    ChildProcess へ 'error' イベントが emit され、リスナーがいないため
			//    親プロセスが uncaughtException でクラッシュする。コールバックを
			//    渡すとエラーはコールバック引数に渡され、'error' emit が抑止される
			// 2. send() の戻り値 false はバックプレッシャ（送信キュー滞留）でも
			//    発生するため、戻り値でのフォールバック判定は健在な子への早すぎる
			//    SIGTERM（graceful cleanup のスキップ）につながる。実際に届かなかった
			//    場合だけコールバックの error で判定する
			proc.send({ type: ':kill' }, (error) => {
				if (error) {
					proc.kill();
				}
			});
		});

		return this.#closePromise;
	}

	#error(error: unknown) {
		let message = 'unknown error';
		let stack = '';
		if (error instanceof Error) {
			message = error.message;
			stack = error.stack ?? '';
		}

		this.#log('❌ error: %o', error);
		this.#process.send?.({
			type: ':error',
			payload: [message, stack],
		});
	}

	#exit() {
		if (this.#type !== 'main') {
			this.#log('Cleaning with exiting');
			this.#process.removeAllListeners();
			this.#listeners.clear();
			this.#returnListeners.clear();
			this.#log(
				'listenerCount(%o): %d',
				'message',
				this.#process.listenerCount('message'),
			);
		}
	}

	async #init(config: ProcTalkConfig<T, O>) {
		this.#process.on('message', this.#onMessage.bind(this));

		if (config.type === 'main') {
			return;
		}

		process.on('exit', this.#exit.bind(this));

		try {
			const options = JSON.parse(process.argv[2] ?? '{}') as O;
			this.#cleanup = (await config.process.call(this, options)) ?? null;

			this.#process.send?.({
				type: 'initialized',
			});
		} catch (error: unknown) {
			// Without this, a throw inside the child's `process` callback (e.g. readPageHooks
			// failing because a hook path is missing) becomes an unhandled promise rejection
			// and the child silently exits, leaving the parent waiting forever on initialized().
			this.#error(error);
		}
	}

	async #onMessage(message?: {
		type?: string;
		payload?: unknown[];
		returns?: unknown[];
	}) {
		const receivedType = message?.type;

		if (receivedType === 'initialized') {
			this.#initialized.resolve();
			return;
		}

		if (
			this.#type === 'child' &&
			!(this.#process instanceof ChildProcess) &&
			receivedType === ':kill'
		) {
			if (this.#cleanup) {
				await this.#cleanup();
			}
			this.#process.exit(0);
			return;
		}

		if (
			this.#type === 'main' &&
			this.#process instanceof ChildProcess &&
			receivedType === ':error'
		) {
			this.#log('Unexpected error in process: %O', message?.payload);
			if (this.#type === 'main' && this.#process instanceof ChildProcess) {
				this.#process.kill();
				const errorMessage = message?.payload?.[0]
					? `${message?.payload?.[0]}`
					: 'Unexpected error in process';
				const errorStack = message?.payload?.[1] ? `${message?.payload?.[1]}` : '';
				const error = new Error(errorMessage);
				if (errorStack) {
					error.stack = errorStack;
				}
				throw error;
			}
		}

		const payload = message?.payload;
		const returns = message?.returns;
		const listener = receivedType ? this.#listeners.get(receivedType) : null;
		const returnListener = receivedType ? this.#returnListeners.get(receivedType) : null;

		this.#log('◀️ Received: %o', {
			type: receivedType,
			payload,
			returns,
			listener: typeof listener === 'function',
			returnListener: typeof returnListener === 'function',
		});

		if (payload && typeof listener === 'function') {
			const args = deserialize(payload, this.#log);
			try {
				const res = await listener(...args);
				this.#log('▶️ await listener(%o, %o) => %O', receivedType, args, res);
				const returns = serialize([res], this.#log);
				this.#log('▶️ send(%o, %O)', receivedType, returns);
				this.#process.send?.({
					type: receivedType,
					returns,
				});
			} catch (error: unknown) {
				this.#error(error);
			}
		}

		if (returns && typeof returnListener === 'function') {
			if (receivedType) {
				this.#listeners.delete(receivedType);
			}
			const args = deserialize(returns, this.#log);
			this.#log('▶️ returnListener(%o, %o)', receivedType, args);
			returnListener({ type: receivedType, returns: args });
		}
	}
}
