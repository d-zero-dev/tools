import type { DelayOptions } from '@d-zero/shared/delay';

import { sampleDistribution } from '@d-zero/shared/sample-distribution';

/**
 * Synchronously resolves a `number | DelayOptions` to a concrete number.
 *
 * Why: `delay()` resolves the same shape but actually waits. For values
 * that need to be passed into a browser `evaluate` call (e.g. scroll step
 * distance), we need the sampled number without any time elapsing.
 * @param value - The value to resolve.
 * @returns A concrete number.
 */
export function resolveValue(value: number | DelayOptions): number {
	if (typeof value === 'number') {
		return value;
	}
	const random = value.random;
	if (typeof random === 'number') {
		return sampleDistribution(random);
	}
	return sampleDistribution({ min: random.min, max: random.max }, random.distribution);
}
