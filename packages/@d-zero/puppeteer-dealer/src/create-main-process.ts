import type {
	ChildProcessCommands,
	CommonParams,
	Logger,
	PuppeteerDealerOptions,
} from './types.js';
import type { LaunchOptions } from 'puppeteer';

import { ProcTalk } from '@d-zero/proc-talk';

/**
 *
 * @param subModulePath
 * @param params
 * @param options
 */
export function createProcess<P, R = void>(
	subModulePath: string,
	params: P,
	options?: PuppeteerDealerOptions & LaunchOptions,
) {
	return (needAuth: boolean) =>
		new ChildProcessManager<P, R>(subModulePath, { ...params, needAuth }, options);
}

export class ChildProcessManager<P, R> {
	#procTalk: ProcTalk<
		ChildProcessCommands<P & CommonParams, R>,
		PuppeteerDealerOptions & LaunchOptions
	>;

	constructor(
		subModulePath: string,
		params: P & CommonParams,
		options?: PuppeteerDealerOptions & LaunchOptions,
	) {
		this.#procTalk = new ProcTalk<
			ChildProcessCommands<P & CommonParams, R>,
			PuppeteerDealerOptions & LaunchOptions
		>({
			type: 'main',
			subModulePath,
			options,
		});

		this.#procTalk.bind('init', () => Promise.resolve(params));
	}

	/**
	 * `await using` 宣言のスコープ脱出時に呼ばれ、{@link ChildProcessManager.close} と
	 * 同じ解放処理を行う。
	 * @example
	 * ```ts
	 * {
	 *   await using processManager = createProcess()(needAuth);
	 *   await processManager.ready();
	 *   await processManager.each(id, url, index);
	 * } // スコープ脱出時（例外発生時を含む）に必ず子プロセスと Chromium が閉じられる
	 * ```
	 */
	async [Symbol.asyncDispose]() {
		await this.#close();
	}
	/**
	 * 子プロセス（と、その中で起動している Chromium）を終了させる。
	 * 複数回呼び出しても安全（{@link ProcTalk.close} 経由で冪等）。
	 * @deprecated `await using` 宣言（`Symbol.asyncDispose`）による自動解放を使用すること。
	 * スコープと解放タイミングが一致しない場合のみ直接呼び出す。
	 */
	async close() {
		await this.#close();
	}

	async each(id: string, url: string, index: number) {
		return await this.#procTalk.call('each', id, url, index);
	}
	log(logger: Logger) {
		this.#procTalk.bind('log', logger);
	}
	async ready() {
		await this.#procTalk.initialized();
	}
	async #close() {
		await this.#procTalk[Symbol.asyncDispose]();
	}
}
