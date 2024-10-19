/**
 * Splits an array into chunks of the specified size.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} a - The array to be split.
 * @param {number} count - The size of each smaller array.
 * @returns {T[][]} Chunks of the original array.
 */
export function splitArray<T>(a: T[], count: number): T[][] {
	a = [...a];
	const n: T[][] = [];
	while (a.length > 0) {
		const s = a.splice(0, count);
		n.push(s);
	}
	return n;
}
