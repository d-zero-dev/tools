import {
	sampleDistribution,
	type BimodalDistribution,
	type CustomDistribution,
	type DistributionPreset,
} from './sample-distribution.js';

/**
 * Random delay range configuration.
 * - number: delays by a random value from 0 to the specified value (exclusive)
 * - {min, max}: delays by a random value from min to max (exclusive)
 * - {min, max, distribution?}: delays with specified probability distribution
 */
export type RandomDelayRange =
	| number
	| {
			min: number;
			max: number;
			/**
			 * Probability distribution type for random delay generation.
			 * - If not specified, defaults to 'uniform' (backward compatible)
			 * - Use preset types or provide a custom weight function
			 */
			distribution?: DistributionPreset | BimodalDistribution | CustomDistribution;
	  };

/**
 * Options for delay with random duration.
 */
export type DelayOptions = {
	/**
	 * Random range for delay duration in milliseconds.
	 */
	random: RandomDelayRange;
};

/**
 * Delays the execution of code by the specified number of milliseconds.
 * @param msOrOptions - The number of milliseconds to delay, or options specifying a random delay range.
 * @param callback - Optional callback that receives the determined interval in milliseconds. Called synchronously before the delay starts.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(
	msOrOptions: number | DelayOptions,
	callback?: (determinedInterval: number) => void,
): Promise<void> {
	const ms =
		typeof msOrOptions === 'number'
			? msOrOptions
			: (() => {
					const random = msOrOptions.random;
					if (typeof random === 'number') {
						return sampleDistribution(random);
					}
					return sampleDistribution(
						{ min: random.min, max: random.max },
						random.distribution,
					);
				})();
	callback?.(ms);
	return new Promise<void>((r) => setTimeout(r, ms));
}
