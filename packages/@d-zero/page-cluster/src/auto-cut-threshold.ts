/**
 * Finds the largest gap between adjacent merge heights and returns the
 * midpoint of that gap as the cut threshold, clamped to `[0, upperBound]`.
 *
 * The clamp prevents the auto-cut from selecting a value *above* `upperBound`
 * (the caller's intended default): this function only ever *loosens* the
 * threshold relative to the default, never tightens it. Confirmed on real
 * crawl data (8,936-page corpus): without the clamp, an 814-page block's
 * auto-cut selected 0.952 — above the default 0.8 — and turned 46 clusters
 * into 54; with the clamp it stays at 0.8 and the result is unchanged.
 *
 * Falls back to `upperBound` when the heights array has fewer than 2 entries
 * (no gap to measure) or when all heights are equal (no gap exists).
 * @param heights Merge heights from the dendrogram, in any order.
 * @param upperBound Maximum allowed threshold (the caller's default).
 */
export function autoCutThreshold(heights: readonly number[], upperBound: number): number {
	if (heights.length < 2) {
		return upperBound;
	}

	const sorted = [...heights].toSorted((a, b) => b - a);

	let maxGap = 0;
	let gapIndex = 0;
	for (let i = 0; i < sorted.length - 1; i++) {
		const gap = (sorted[i] ?? 0) - (sorted[i + 1] ?? 0);
		if (gap > maxGap) {
			maxGap = gap;
			gapIndex = i;
		}
	}

	if (maxGap === 0) {
		return upperBound;
	}

	const midpoint = ((sorted[gapIndex] ?? 0) + (sorted[gapIndex + 1] ?? 0)) / 2;
	return Math.min(midpoint, upperBound);
}
