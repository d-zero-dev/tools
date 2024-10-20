import type { PuppeteerDealerOptions, PuppeteerDealHandler, URLInfo } from './types.js';
import type { DealHeader } from '@d-zero/dealer';
import type { Page, PuppeteerLaunchOptions } from 'puppeteer';

import { deal as coreDeal } from '@d-zero/dealer';
import c from 'ansi-colors';
import puppeteer from 'puppeteer';

export async function deal(
	list: readonly URLInfo[],
	header: DealHeader,
	handler: PuppeteerDealHandler,
	options?: PuppeteerDealerOptions & PuppeteerLaunchOptions,
) {
	const config = {
		locale: 'ja-JP',
		...options,
	};

	const browser = await puppeteer.launch({
		headless: true,
		args: [
			//
			`--lang=${config.locale}`,
			'--no-zygote',
			'--ignore-certificate-errors',
		],
		...config,
	});

	await coreDeal(
		list,
		({ id, url }, update, index) => {
			const fileId = id || index.toString().padStart(3, '0');
			const lineHeader = `%braille% ${c.bgWhite(` ${fileId} `)} ${c.gray(url.toString())}: `;

			return async () => {
				const continued = await handler.beforeOpenPage?.(
					fileId,
					url.toString(),
					(log) => update(`${lineHeader}${log}`),
					index,
				);

				if (continued === false) {
					return;
				}

				const page = await browser.newPage();
				page.setDefaultNavigationTimeout(0);

				if (config.locale) {
					await page.setExtraHTTPHeaders({
						'Accept-Language': config.locale,
					});
				}

				await handler
					.deal(
						page,
						fileId,
						url.toString(),
						(log) => update(`${lineHeader}${log}`),
						index,
					)
					.catch(evaluationError(page, url.toString(), fileId, index));

				await page.close();
			};
		},
		{
			...config,
			header,
		},
	);

	await browser.close();
}

function evaluationError(page: Page, url: string, fileId: string, index: number) {
	return (error: unknown) => {
		if (
			error instanceof Error &&
			error.message.includes('Execution context was destroyed')
		) {
			error.message +=
				'\n' +
				c.red(
					[
						`PuppeteerDealer.deal() failed:`,
						`    URL: ${url}`,
						`    ID: ${fileId}`,
						`    Index: ${index}`,
						'    Page:',
						`        url: ${page.url()}`,
						`        isClosed: ${page.isClosed()}`,
						'    Browser:',
						`        connected: ${page.browser().connected}`,
					].join('\n'),
				);
			throw error;
		}

		throw error;
	};
}
