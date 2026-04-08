import type { Result, NeedAnalysis, Passed, Scenario } from './types.js';

import { createChildProcess } from '@d-zero/puppeteer-dealer';
import {
	beforePageScan,
	defaultSizes,
	pageScanListener,
} from '@d-zero/puppeteer-page-scan';
import { Cache } from '@d-zero/shared/cache';
import c from 'ansi-colors';

import { importScenarios, type Violation } from '@d-zero/a11y-check-core';

export type ChildProcessParams = {
	readonly scenarios: readonly Scenario[];
	readonly cacheDir: string;
};

createChildProcess<ChildProcessParams, Result>(async (param) => {
	const { cacheDir } = param;

	const cache = new Cache<Result>('a11y-check/run-puppeteer', cacheDir);

	const sizes = {
		desktop: defaultSizes.desktop,
		mobile: defaultSizes.mobile,
	} as const;

	const scenarios = await importScenarios(param.scenarios);

	return {
		// async beforeOpenPage(_, url, logger) {
		// 	if (options?.cache === false) {
		// 		logger('Clearing cache');
		// 		await cache.clear();
		// 	}

		// 	logger('Restoring cache');
		// 	const cached = await cache.load(url, (key, value) => {
		// 		if (key === 'timestamp') {
		// 			return new Date(Date.parse(value));
		// 		}
		// 		return value;
		// 	});

		// 	if (cached) {
		// 		logger('Hit cache, skipping page scan');
		// 		await delay(600);
		// 		needAnalysis.push(...cached.needAnalysis);
		// 		passed.push(...cached.passed);
		// 		violations.push(...cached.violations);
		// 		return false;
		// 	}

		// 	return true;
		// },
		async eachPage({ page, url }, logger) {
			const urlNeedAnalysis: NeedAnalysis[] = [];
			const urlPassed: Passed[] = [];
			const urlViolations: Violation[] = [];

			for (const [name, size] of Object.entries(sizes)) {
				const sizeLabel = c.bgMagenta(` ${name} `);

				for (const scenario of scenarios) {
					await beforePageScan(page, url, {
						name,
						...size,
						listener: pageScanListener(logger),
					});

					const scenarioResult = await scenario.exec(page, name, (log) =>
						logger(`${sizeLabel} ${log}`),
					);

					urlNeedAnalysis.push(...(scenarioResult.needAnalysis ?? []));
					urlPassed.push(...(scenarioResult.passed ?? []));
					urlViolations.push(...(scenarioResult.violations ?? []));
				}
			}

			const urlResults: Result = {
				needAnalysis: urlNeedAnalysis,
				passed: urlPassed,
				violations: urlViolations,
			};

			await cache.store(url, urlResults);

			return urlResults;
		},
	};
});
