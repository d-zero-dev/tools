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

	async close() {
		await this.#procTalk.close();
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
}
