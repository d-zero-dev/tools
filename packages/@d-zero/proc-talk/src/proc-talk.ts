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
			process: (this: ProcTalk<T, O>, options?: O) => void | Promise<void>;
	  };

export class ProcTalk<T, O = void> {
	readonly #callLog: typeof log;
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
			this.#process = fork(
				//
				config.subModulePath,
				[JSON.stringify(config.options ?? {})],
				{
					detached: true,
				},
			);
		} else {
			this.#process = process;
		}

		this.#id = this.#process.pid ?? -1;

		this.#log = log.extend(`${this.#type}:${this.#id}`);
		this.#initLog = this.#log.extend('init');
		this.#callLog = this.#log.extend('call');

		void this.#init(config);
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

	close() {
		if (this.#type === 'main' && this.#process instanceof ChildProcess) {
			try {
				this.#process.kill();
				return true;
			} catch (error) {
				if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
					return false;
				}
				throw error;
			}
		}

		throw new Error('Cannot close main process');
	}

	async initialized(): Promise<void> {
		this.#initLog('await');
		await this.#initialized.promise();
		this.#initLog('done');
	}

	log(...args: Parameters<typeof log>) {
		this.#log(...args);
	}

	async #init(config: ProcTalkConfig<T, O>) {
		this.#process.on('message', this.#onMessage.bind(this));

		process.on('exit', () => {
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
		});

		if (config.type === 'main') {
			return;
		}

		const options = JSON.parse(process.argv[2] ?? '{}') as O;
		await config.process.call(this, options);
		this.#process.send?.({
			type: 'initialized',
		});
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
			const res = await listener(...args);
			this.#log('▶️ await listener(%o, %o) => %O', receivedType, args, res);
			const returns = serialize([res], this.#log);
			this.#log('▶️ send(%o, %O)', receivedType, returns);
			this.#process.send?.({
				type: receivedType,
				returns,
			});
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
