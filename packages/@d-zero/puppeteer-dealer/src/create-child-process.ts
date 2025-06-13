import type { Logger, PuppeteerDealerOptions } from './types.js';
import type { Page, LaunchOptions } from 'puppeteer';

import { ProcTalk } from '@d-zero/proc-talk';
import puppeteer from 'puppeteer';

import { log } from './debug.js';

const childLog = log.extend(`child:${process.pid}`);

export type ChildProcessMethods<R> = {
	eachPage: (params: EachPageParams, logger: Logger) => Promise<R>;
};

type EachPageParams = {
	readonly page: Page;
	readonly id: string;
	readonly url: string;
	readonly index: number;
};

export type ChildProcessCommonParams = {
	readonly id: string;
	readonly url: string;
	readonly logger: Logger;
};

export type ChildProcessHandler<P, R> = (
	params: P,
) => Promise<ChildProcessMethods<R>> | ChildProcessMethods<R>;

export type ChildProcessCommands<P, R> = {
	init: () => Promise<P>;
	each: (id: string, url: string, index: number) => Promise<R>;
	log: Logger;
};

/**
 *
 * @param handler
 */
export function createChildProcess<P, R = void>(handler: ChildProcessHandler<P, R>) {
	new ProcTalk<ChildProcessCommands<P, R>, PuppeteerDealerOptions & LaunchOptions>({
		type: 'child',
		title: '@d-zero/puppeteer-dealer',
		async process(options) {
			const config = {
				locale: 'ja-JP',
				...options,
			};

			childLog('Process started: %O', config);

			const params = await this.call('init');

			childLog('Params: %O', params);

			const { eachPage } = await handler(params);

			const launchOptions: LaunchOptions = {
				headless: true,
				args: [
					//
					`--lang=${config.locale}`,
					'--no-zygote',
					'--ignore-certificate-errors',
					'--no-sandbox',
					'--disable-web-security',
					'--disable-features=SafeBrowsing',
				],
				...config,
			};

			childLog('Launch options: %O', launchOptions);
			const browser = await puppeteer.launch(launchOptions);

			const page = await browser?.newPage();

			if (!page) {
				throw new Error('Failed to create page');
			}

			page.setDefaultNavigationTimeout(0);

			if (config.locale) {
				await page.setExtraHTTPHeaders({
					'Accept-Language': config.locale,
				});
			}

			childLog('Page is ready');

			this.bind('each', async (id: string, url: string, index: number) => {
				const result = await eachPage({ page, id, url, index }, async (log) => {
					await this.call('log', log);
				});

				return result;
			});

			return async () => {
				childLog('Close page and browser');
				await page.close();
				await browser.close();
				childLog('Cleanup done');
			};
		},
	});
}
