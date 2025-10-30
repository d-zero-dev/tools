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
 * @param ms - The number of milliseconds to delay.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(ms: number): Promise<void>;

/**
 * Delays the execution of code by a random duration within the specified range.
 * @param options - Options specifying the random delay range.
 * @returns A promise that resolves after the random delay.
 */
export function delay(options: DelayOptions): Promise<void>;

export function delay(msOrOptions: number | DelayOptions): Promise<void> {
	const ms =
		typeof msOrOptions === 'number' ? msOrOptions : randomInt(msOrOptions.random);
	return new Promise<void>((r) => setTimeout(r, ms));
}
