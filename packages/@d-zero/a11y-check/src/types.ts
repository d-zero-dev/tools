import type { CoreOptions, ScenarioRunnerOptions } from '@d-zero/a11y-check-core';

export type A11yCheckOptions = {
	readonly scenarios?: readonly string[];
} & CoreOptions &
	ScenarioRunnerOptions;
