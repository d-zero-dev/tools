/* use as a sub-process */
process.title = '@d-zero/puppeteer-page:child-process';

import type { ExtendedPageInterface } from './types.js';
import type { PuppeteerLaunchOptions } from 'puppeteer';

import AxePuppeteer from '@axe-core/puppeteer';
import { ProcTalk } from '@d-zero/proc-talk';
import puppeteer from 'puppeteer';

new ProcTalk<ExtendedPageInterface, PuppeteerLaunchOptions>({
	type: 'child',
	async process(options) {
		this.log('Starting puppeteer: %O', options);

		const browser = await puppeteer.launch(options);
		const page = await browser?.newPage();

		const cleanUp = async () => {
			this.log('Cleanup start');
			await page?.close();
			await browser?.close();
			this.log('Cleanup done');
		};

		this.bind('content', page.content.bind(page));
		this.bind('evaluate', page.evaluate.bind(page));
		this.bind('goto', page.goto.bind(page));
		this.bind('on', page.on.bind(page));
		this.bind('pdf', page.pdf.bind(page));
		this.bind('reload', page.reload.bind(page));
		this.bind('screenshot', page.screenshot.bind(page));
		this.bind('setDefaultNavigationTimeout', page.setDefaultNavigationTimeout.bind(page));
		this.bind('setExtraHTTPHeaders', page.setExtraHTTPHeaders.bind(page));
		this.bind('setViewport', page.setViewport.bind(page));
		this.bind('title', page.title.bind(page));
		this.bind('url', page.url.bind(page));

		this.bind('axe', async (config) => {
			return new AxePuppeteer(page).configure(config).analyze();
		});

		this.bind(
			'elementScreenshot',
			// @ts-ignore
			async (selector, options) => {
				const fileElement = await page.waitForSelector(selector);
				return (await fileElement?.screenshot(options)) ?? null;
			},
		);

		this.bind('close', async () => {
			await cleanUp();
		});
	},
});
