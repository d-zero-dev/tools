import type {
	CoreOptions,
	NeedAnalysis,
	Passed,
	Result,
	Scenario,
	ScenarioRunnerOptions,
} from './types.js';
import type { Violation } from '@d-zero/a11y-check-core';

import { deal } from '@d-zero/puppeteer-dealer';
import {
	beforePageScan,
	defaultSizes,
	pageScanListener,
} from '@d-zero/puppeteer-page-scan';
import { Cache } from '@d-zero/shared/cache';
import { delay } from '@d-zero/shared/delay';
import c from 'ansi-colors';

import { cleanResults } from './clean-results.js';

export async function scenarioRunner<O>(
	urlList: readonly (
		| string
		| {
				id: string | null;
				url: string;
		  }
	)[],
	scenarios: readonly Scenario[],
	options?: O & CoreOptions & ScenarioRunnerOptions,
): Promise<Result> {
	const cache = new Cache<Result>('a11y-check/run-puppeteer', options?.cacheDir);

	const hooks = options?.hooks;

	const sizes = {
		desktop: defaultSizes.desktop,
		mobile: defaultSizes.mobile,
	} as const;

	const needAnalysis: NeedAnalysis[] = [];
	const passed: Passed[] = [];
	const violations: Violation[] = [];

	await deal(
		urlList.map((url) => {
			if (typeof url === 'string') {
				return { id: null, url };
			}
			return url;
		}),
		(_, done, total) => {
			return `${c.bold.magenta('🧿 A11y checking%dots%')} ${done}/${total}`;
		},
		{
			async beforeOpenPage(_, url, logger) {
				if (options?.cache === false) {
					logger('Clearing cache');
					await cache.clear();
				}

				logger('Restoring cache');
				const cached = await cache.load(url, (key, value) => {
					if (key === 'timestamp') {
						return new Date(Date.parse(value));
					}
					return value;
				});

				if (cached) {
					logger('Hit cache, skipping page scan');
					await delay(600);
					needAnalysis.push(...cached.needAnalysis);
					passed.push(...cached.passed);
					violations.push(...cached.violations);
					return false;
				}

				return true;
			},
			async deal(page, _, url, logger) {
				const urlNeedAnalysis: NeedAnalysis[] = [];
				const urlPassed: Passed[] = [];
				const urlViolations: Violation[] = [];

				for (const [name, size] of Object.entries(sizes)) {
					const sizeLabel = c.bgMagenta(` ${name} `);

					for (const scenario of scenarios) {
						await beforePageScan(page, url, {
							name,
							...size,
							hooks,
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

				needAnalysis.push(...urlNeedAnalysis);
				passed.push(...urlPassed);
				violations.push(...urlViolations);
			},
		},
		options,
	);

	const cleanedViolations = cleanResults(violations);

	process.stdout.write(`📊 Found ${cleanedViolations.length} violations\n`);

	for (const scenario of scenarios) {
		const targets = needAnalysis.filter((result) => result.scenarioId === scenario.id);
		if (targets.length === 0) {
			continue;
		}
		await scenario.analyze?.(targets, (log) => process.stdout.write(`${log}\n`));
	}

	return {
		needAnalysis: needAnalysis,
		passed: passed,
		violations: cleanedViolations,
	};
}
