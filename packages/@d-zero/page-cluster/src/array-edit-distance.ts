/**
 * Reads `row[index]`, throwing instead of returning `undefined`. The DP loop
 * below only ever indexes within bounds it just built, so the thrown branch
 * is unreachable in practice; it exists to satisfy `noUncheckedIndexedAccess`
 * without a non-null assertion. Named `readDpValue` rather than `at` to avoid
 * reading as (and being confused for) `Array.prototype.at`, whose negative-
 * index-from-end semantics this helper does not share.
 * @param row
 * @param index
 */
function readDpValue(row: readonly number[], index: number): number {
	const value = row[index];
	if (value === undefined) {
		throw new Error('arrayEditDistance: DP row index out of bounds');
	}
	return value;
}

/**
 * Element-wise Levenshtein distance between two `tokenize()` outputs, for
 * the small set of comparisons that need order/nesting to matter (refining
 * a merge distance between near-duplicate candidates, spot-checking cluster
 * quality) rather than the set-based similarity used for bulk narrowing.
 * Operates on whole array elements, not characters, so a single differing
 * path costs 1 edit regardless of its string length. This is the same
 * O(n*m) dynamic-programming shape as tree edit distance, but requires no
 * tree: run directly on the flat leaf-path arrays `tokenize()` already
 * produces, which is why it stays viable at the scale this comparison is
 * meant for (small numbers of already-narrowed candidates, not all-pairs).
 * @param a
 * @param b
 * @example
 * ```ts
 * arrayEditDistance(['body>ul>li', 'body>ul>li'], ['body>ul>li']);
 * // 1
 * ```
 */
export function arrayEditDistance(a: readonly string[], b: readonly string[]): number {
	const rowCount = a.length;
	const colCount = b.length;

	let previousRow = Array.from({ length: colCount + 1 }, (_, index) => index);

	for (let row = 1; row <= rowCount; row++) {
		const currentRow = [row];
		for (let col = 1; col <= colCount; col++) {
			currentRow.push(
				a[row - 1] === b[col - 1]
					? readDpValue(previousRow, col - 1)
					: 1 +
							Math.min(
								readDpValue(previousRow, col),
								readDpValue(currentRow, col - 1),
								readDpValue(previousRow, col - 1),
							),
			);
		}
		previousRow = currentRow;
	}

	return readDpValue(previousRow, colCount);
}
