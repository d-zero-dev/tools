import type { ChildProcessParams } from './scenario-child-process.js';
import type {
	CoreOptions,
	NeedAnalysis,
	Passed,
	Result,
	Scenario,
	ScenarioRunnerOptions,
} from './types.js';
import type { DealOptions } from '@d-zero/dealer';

import path from 'node:path';

import { importScenarios, type Violation } from '@d-zero/a11y-check-core';
import { createProcess, deal } from '@d-zero/puppeteer-dealer';
import c from 'ansi-colors';

import { cleanResults } from './clean-results.js';

/**
 *
 * @param urlList
 * @param scenarios
 * @param options
 */
export async function scenarioRunner<O>(
	urlList: readonly (
		| string
		| {
				id: string | null;
				url: string;
		  }
	)[],
	scenarios: readonly Scenario[],
	options?: O & CoreOptions & ScenarioRunnerOptions & DealOptions,
): Promise<Result> {
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
		() => {
			return createProcess<ChildProcessParams, Result>(
				path.resolve(import.meta.dirname, 'scenario-child-process.js'),
				{
					scenarios,
					cacheDir: options?.cacheDir ?? '.a11y-check-core',
				},
				options,
			);
		},
		{
			...options,
			each(result) {
				needAnalysis.push(...result.needAnalysis);
				passed.push(...result.passed);
				violations.push(...result.violations);
			},
		},
	);

	const cleanedViolations = cleanResults(violations);

	process.stdout.write(`📊 Found ${cleanedViolations.length} violations\n`);

	const scenarioModules = await importScenarios(scenarios);

	for (const scenario of scenarioModules) {
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
