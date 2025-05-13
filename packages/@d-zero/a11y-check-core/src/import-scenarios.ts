import type { Scenario, ScenarioCreator } from './types.js';

/**
 *
 * @param scenarios
 */
export async function importScenarios(
	scenarios: readonly [modulePath: string, options?: string][],
) {
	return await Promise.all<Scenario>(
		scenarios.map(async ([modulePath, options]) => {
			const mod = await import(modulePath);
			const creator: ScenarioCreator<unknown> = mod.default;
			const optionsValue = options ? JSON.parse(options) : {};
			return creator(optionsValue);
		}),
	);
}
