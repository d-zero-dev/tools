/**
 * Represents a range for generating random integers.
 * - number: generates a random integer from 0 (inclusive) to the specified value (exclusive)
 * - {min, max}: generates a random integer from min (inclusive) to max (exclusive)
 */
export type RandomIntRange = number | { min: number; max: number };

/**
 * Generates a random integer within the specified range.
 * @param range - The range specification for random number generation
 * @returns A random integer within the specified range
 * @example
 * randomInt(100) // Returns 0-99
 * randomInt({ min: 10, max: 20 }) // Returns 10-19
 */
export function randomInt(range: RandomIntRange): number {
	if (typeof range === 'number') {
		return Math.floor(Math.random() * range);
	}
	const { min, max } = range;
	return Math.floor(Math.random() * (max - min) + min);
}
