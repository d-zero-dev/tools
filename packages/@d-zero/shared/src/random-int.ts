/**
 * Represents a range for generating random integers.
 * - number: generates a random integer from 0 (inclusive) to the specified value (exclusive)
 * - {min, max}: generates a random integer from min (inclusive) to max (exclusive)
 */
export type RandomIntRange = number | { min: number; max: number };

/**
 * Generates a random integer within the specified range.
 * When range is zero/negative or min >= max, returns the lower bound (0 or min).
 * @param range - The range specification for random number generation
 * @returns A random integer within [0, range) or [min, max), or the lower bound when the range is empty
 * @example
 * randomInt(100) // Returns 0-99
 * randomInt({ min: 10, max: 20 }) // Returns 10-19
 * randomInt(0) // Returns 0
 * randomInt({ min: 5, max: 5 }) // Returns 5
 */
export function randomInt(range: RandomIntRange): number {
	if (typeof range === 'number') {
		if (range <= 0) {
			return 0;
		}
		return Math.floor(Math.random() * range);
	}
	const { min, max } = range;
	if (min >= max) {
		return min;
	}
	return Math.floor(Math.random() * (max - min) + min);
}
