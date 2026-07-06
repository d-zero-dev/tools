/**
 * Merges a set of (possibly overlapping or nested) `[start, end)` spans into
 * the smallest equivalent set of disjoint spans, sorted by start offset.
 * Matched spans commonly nest in real markup (e.g. a site nav living inside
 * the header, `<header><nav>...</nav></header>`) — merging first means the
 * later excision pass never has to reason about overlap.
 * @param spans
 */
export function mergeSpans(
	spans: readonly { start: number; end: number }[],
): { start: number; end: number }[] {
	const sorted = [...spans].toSorted((a, b) => a.start - b.start);
	const merged: { start: number; end: number }[] = [];
	for (const span of sorted) {
		const last = merged.at(-1);
		if (last && span.start <= last.end) {
			last.end = Math.max(last.end, span.end);
		} else {
			merged.push({ ...span });
		}
	}
	return merged;
}
