import type {
	ChildProcessCommands,
	ChildProcessHandler,
	CommonParams,
	PuppeteerDealerOptions,
} from './types.js';
import type * as Puppeteer from 'puppeteer';

import { ProcTalk } from '@d-zero/proc-talk';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// @ts-ignore
const puppeteer: typeof Puppeteer = puppeteerExtra;

// @ts-ignore
puppeteer.use(StealthPlugin());

import { log } from './debug.js';

const childLog = log.extend(`child:${process.pid}`);

/**
 *
 * @param handler
 */
export function createChildProcess<P, R = void>(
	handler: ChildProcessHandler<P & CommonParams, R>,
) {
	new ProcTalk<
		ChildProcessCommands<P & CommonParams, R>,
		PuppeteerDealerOptions & Puppeteer.LaunchOptions
	>({
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

			childLog('Needs auth: %s', params.needAuth);

			const { eachPage } = await handler(params);

			const launchOptions: Puppeteer.LaunchOptions = {
				headless: config.headless ?? (params.needAuth ? 'shell' : true),
				args: [
					//
					`--lang=${config.locale}`,
					'--no-zygote',
					'--ignore-certificate-errors',
					'--no-sandbox',
					'--disable-web-security',
					'--disable-features=SafeBrowsing',
					'--disable-setuid-sandbox',
					'--disable-gpu',
					'--disable-dev-shm-usage',
					'--disable-quic',
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
