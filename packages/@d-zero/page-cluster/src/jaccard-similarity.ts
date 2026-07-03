/**
 * Structural-similarity primitive shared by two downstream stages that are
 * not yet implemented: base-cluster generation over `tokenize()` output
 * turned into sets (MinHash/LSH candidate scoring approximates this same
 * ratio) and the default distance for merging medoids in the eventual
 * hierarchical clustering step. Both need "how much of these two token sets
 * overlaps" as a plain, parameter-free calculation, independent of whichever
 * hashing/banding scheme ends up approximating it at scale.
 *
 * Two empty sets return `1`, not `0` or `NaN`: an empty `<body>` compared
 * against another empty `<body>` has no structural difference to report, so
 * treating them as identical (rather than "undefined" or "no overlap") keeps
 * the result usable directly as a similarity score without a caller-side
 * special case.
 * @param a
 * @param b
 * @example
 * ```ts
 * jaccardSimilarity(new Set(['body>ul>li']), new Set(['body>ul>li']));
 * // 1
 * ```
 */
export function jaccardSimilarity(
	a: ReadonlySet<string>,
	b: ReadonlySet<string>,
): number {
	if (a.size === 0 && b.size === 0) {
		return 1;
	}

	let intersectionSize = 0;
	const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
	for (const token of smaller) {
		if (larger.has(token)) {
			intersectionSize++;
		}
	}

	const unionSize = a.size + b.size - intersectionSize;
	return intersectionSize / unionSize;
}
