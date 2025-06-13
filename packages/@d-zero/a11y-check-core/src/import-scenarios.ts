import type { Scenario, ScenarioCreator } from './types.js';

/**
 *
 * @param scenarios
 */
export async function importScenarios(scenarios: readonly Scenario[]) {
	return await Promise.all<Scenario>(
		scenarios.map(async (scenario) => {
			const mod = await import(scenario.modulePath);
			const creator: ScenarioCreator<unknown> = mod.default;
			const optionsValue = JSON.parse(scenario.moduleParams);
			return creator(optionsValue);
		}),
	);
}
