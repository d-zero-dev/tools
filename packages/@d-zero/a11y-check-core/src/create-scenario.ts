import type { ScenarioCreator } from './types.js';

/**
 *
 * @param creator
 */
export function createScenario<O>(creator: ScenarioCreator<O>) {
	return creator;
}
