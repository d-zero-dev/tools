/**
 * Largest value in `values`, or `0` for an empty array. Assumes all values
 * are non-negative (box coordinates, sizes, counts) — the only callers in
 * this package — so `0` doubles as both the empty-array result and a safe
 * starting accumulator.
 *
 * WHY not `Math.max(...values)`: spreading into a function call passes
 * each element as its own call argument, and V8 (and most engines) throws
 * `RangeError: Maximum call stack size exceeded` once the argument count
 * reaches roughly 65k–125k. A container with a very large number of
 * meaningful children (a long list or table region) can realistically hit
 * that, which would abort classification for the whole page instead of
 * degrading to a low-confidence result.
 * @param values
 * @example
 * ```ts
 * maxOf([3, 1, 4, 1, 5]); // 5
 * maxOf([]); // 0
 * ```
 */
export function maxOf(values: readonly number[]): number {
	let max = 0;
	for (const value of values) {
		if (value > max) {
			max = value;
		}
	}
	return max;
}
