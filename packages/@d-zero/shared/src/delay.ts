import { randomInt, type RandomIntRange } from './random-int.js';

/**
 * Options for delay with random duration.
 */
export type DelayOptions = {
	/**
	 * Random range for delay duration in milliseconds.
	 * - number: delays by a random value from 0 to the specified value (exclusive)
	 * - {min, max}: delays by a random value from min to max (exclusive)
	 */
	random: RandomIntRange;
};

/**
 * Delays the execution of code by the specified number of milliseconds.
 * @param msOrOptions - The number of milliseconds to delay, or options specifying a random delay range.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(msOrOptions: number | DelayOptions): Promise<void> {
	const ms =
		typeof msOrOptions === 'number' ? msOrOptions : randomInt(msOrOptions.random);
	return new Promise<void>((r) => setTimeout(r, ms));
}
