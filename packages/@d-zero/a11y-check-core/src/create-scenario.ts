import type { ScenarioCreator } from './types.js';

export function createScenario<O>(creator: ScenarioCreator<O>) {
	return creator;
}
