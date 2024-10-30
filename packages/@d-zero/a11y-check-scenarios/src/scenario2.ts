import type { ScenarioOptions } from './types.js';
import type { NeedAnalysis } from '@d-zero/a11y-check-core';

import { createScenario } from '@d-zero/a11y-check-core';
import { Cache } from '@d-zero/shared/cache';
import c from 'ansi-colors';

const scenarioId = 'a11y-check/scenario02';

export default createScenario((options?: ScenarioOptions) => {
	const cache = new Cache<NeedAnalysis[]>(scenarioId, options?.cacheDir);

	return {
		id: scenarioId,
		async exec(page, sizeName, logger) {
			if (options?.cache === false) {
				await cache.clear();
			}

			const key = page.url() + '#' + sizeName + '@' + scenarioId;

			const cached = await cache.load(key, (key, value) => {
				if (key === 'timestamp') {
					return new Date(Date.parse(value));
				}
				return value;
			});

			if (cached) {
				return {
					needAnalysis: cached,
				};
			}

			const needAnalysis: NeedAnalysis[] = [];

			const navigations = ['header', 'nav', 'footer', "[class*='nav' i]"];

			for (const selector of navigations) {
				const logBase = `Finding "${selector}"`;
				logger(`Finding "${selector}"`);
				page.on('console', (msg) => {
					const msgType = msg.type();
					switch (msgType) {
						case 'error': {
							logger(`${logBase}: ${c.red(msg.text())}`);
							break;
						}
						default: {
							logger(`${logBase}: ${c.gray(msg.text())}`);
							break;
						}
					}
				});
				const outerHTML = await page.evaluate((selector) => {
					return [...document.querySelectorAll(selector)].map((el) => el.outerHTML);
				}, selector);

				// get selectorがいる
				// HTMLの重複をどうにかする

				if (!outerHTML || outerHTML.length === 0) {
					continue;
				}

				logger(`Found "${selector}" ${outerHTML.length} elements`);

				needAnalysis.push({
					scenarioId,
					id: '',
					url: await page.url(),
					tool: 'a11y-check-scenario02',
					timestamp: new Date(),
					component: selector,
					environment: sizeName,
					data: outerHTML.join('\n\n'),
				});
			}

			await cache.store(key, needAnalysis);

			return {
				needAnalysis,
			};
		},
		analyze(results, logger) {
			for (const data of results) {
				if (!data.data) {
					logger(`No navigations: ${data.url}`);
					continue;
				}
			}
		},
	};
});
