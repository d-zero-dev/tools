/**
 * Deterministic identity of a token set.
 *
 * Uses `JSON.stringify` on the sorted tokens rather than a space-joined
 * string so that pathological (but real) tokens containing spaces can't
 * collide with a different set on the identical joined string `"a b c"`.
 * `JSON.stringify` escapes each array element as its own quoted string, so
 * no element's content can ever be mistaken for the array's structural
 * delimiters.
 *
 * Shared by any pipeline stage that needs two token sets with the exact
 * same members to hash to the same key — e.g.
 * {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * per-landmark-instance frequency histogram construction.
 * @param tokens
 */
export function canonicalizeTokenSet(tokens: ReadonlySet<string>): string {
	return JSON.stringify([...tokens].toSorted());
}
