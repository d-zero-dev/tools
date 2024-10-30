import type { A11yCheckAxeOptions } from './types.js';
import type { AxeResults } from 'axe-core';

import { createScenario } from '@d-zero/a11y-check-core';
import { Cache } from '@d-zero/shared/cache';

import { convertResultsFromViolations } from './convert-results-from-violations.js';

const scenarioId = 'a11y-check/axe';

export default createScenario((options?: A11yCheckAxeOptions) => {
	const cache = new Cache<AxeResults>(scenarioId, options?.cacheDir);

	return {
		id: scenarioId,
		async exec(page, sizeName, log) {
			if (options?.cache === false) {
				await cache.clear();
			}

			const axeLog = (message: string) => log(`🪓 ${message}`);

			const key = (await page.url()) + '#' + sizeName;

			const cached = await cache.load(key, (key, value) => {
				if (key === 'timestamp') {
					return new Date(Date.parse(value));
				}
				return value;
			});

			if (cached) {
				return {
					violations: await convertResultsFromViolations(
						page,
						cached,
						sizeName,
						options?.screenshot ?? false,
						axeLog,
					),
				};
			}

			const axeResults = await page.axe({
				lang: options?.lang ?? 'ja',
				log: axeLog,
			});

			await cache.store(key, axeResults);

			return {
				violations: await convertResultsFromViolations(
					page,
					axeResults,
					sizeName,
					options?.screenshot ?? false,
					axeLog,
				),
			};
		},
	};
});
