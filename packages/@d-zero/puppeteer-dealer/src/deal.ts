import type { PuppeteerDealerOptions, PuppeteerDealHandler, URLInfo } from './types.js';
import type { DealHeader } from '@d-zero/dealer';
import type { Page } from '@d-zero/puppeteer-page';
import type { PuppeteerLaunchOptions } from 'puppeteer';

import { deal as coreDeal } from '@d-zero/dealer';
import { createPage } from '@d-zero/puppeteer-page';
import c from 'ansi-colors';

import { log } from './debug.js';

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

	const childPrecessIds = new Set<number>();

	const cleanUp = () => {
		log('child process IDs: %o', childPrecessIds);
		for (const pid of childPrecessIds) {
			try {
				process.kill(pid);
				log('killed %d', pid);
			} catch (error) {
				log('Already dead: %d', pid);
				if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
					// ignore
					continue;
				}
				throw error;
			}
		}

		if (log.enabled) {
			log('process.getActiveResourcesInfo(): %o', process.getActiveResourcesInfo());
		}
	};

	process.on('exit', cleanUp);

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

				const page = await createPage({
					headless: true,
					args: [
						//
						`--lang=${config.locale}`,
						'--no-zygote',
						'--ignore-certificate-errors',
					],
					...config,
				});

				if (page.pid !== null) {
					childPrecessIds.add(page.pid);
				}

				await page.setDefaultNavigationTimeout(0);

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

	log('PuppeteerDealer.deal() completed');
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
					].join('\n'),
				);
			throw error;
		}

		throw error;
	};
}
