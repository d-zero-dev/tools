import { autoCutThreshold } from './auto-cut-threshold.js';
import { derivePathGroupKey } from './derive-path-group-key.js';

/**
 * Maximum leading URL-path depth `derivePathClusterKeys` will consider when
 * auto-selecting a group-key depth. Empirically past 5 the sweep produces
 * near-per-page keys that are useless as blocking signals for any real site,
 * so this bounds the linear scan cost regardless of input path length.
 */
const MAX_PATH_DEPTH = 5;

/**
 * Below this page count `derivePathClusterKeys` falls back to depth 1
 * unconditionally: the auto-cut needs at least a handful of pages to see a
 * meaningful gap in the depth-vs-key-count curve, and every real
 * "blocking-signal" use case for this function is over corpora larger than
 * this. Chosen conservatively so that small-corpus regression tests stay
 * on the shallowest-depth path they already validated.
 */
const AUTO_CUT_MIN_PAGES = 20;

/**
 * Runs {@link ./derive-path-group-key.js | derivePathGroupKey} for every
 * candidate depth in `1..MAX_PATH_DEPTH` and picks the depth whose
 * increment* in distinct-key count over the previous depth is the largest
 * data-driven gap. Same self-tuning primitive
 * ({@link ./auto-cut-threshold.js | autoCutThreshold}) this package already
 * uses for Stage A merge-height cutoffs, applied recursively at the URL-path
 * layer.
 *
 * ## Why the increment, not the count itself
 *
 * Distinct-key count is monotonically non-decreasing in `depth` (a deeper
 * key partitions strictly more finely), so the raw count only ever rises
 * with `depth` and its max-gap point sits at the highest depth
 * unconditionally. What we actually want is the depth at which adding one
 * more segment *starts* fragmenting into per-page noise — i.e. the
 * transition* between "still discriminating templates" and "just enumerating
 * pages." Feeding the per-depth increment (`count[d] − count[d − 1]`) to
 * `autoCutThreshold` picks the depth just below that transition: the sweep
 * takes the widest jump as the signal that a structural boundary has been
 * crossed and returns the depth immediately before it.
 *
 * ## Degenerate cases
 *
 * - Every page has the same top-level segment → count[1] = 1 for all
 *   depths' worth of comparable growth, so the max gap is (effectively) at
 *   depth 1 and this function returns depth 1
 * - All depths produce identical counts (a pathologically uniform corpus)
 *   → falls back to depth 1
 *
 * ## Not wired into the main clustering path yet
 *
 * `resolvePageClusterKeys` continues to invoke `derivePathGroupKey` with the
 * static default `depth: 1`. This function is exported as a building block
 * for callers who want to opt in (via `pathDepth: 'auto'` on the blocking
 * options), and for a future PR that flips the default after validating the
 * data-driven depth against real corpora — same staged approach every
 * previous auto-cut adoption in this package took.
 * @param pagesPaths
 * @example
 * ```ts
 * derivePathClusterKeys([
 * 	['dept-a', 'news', '1'],
 * 	['dept-a', 'news', '2'],
 * 	['dept-b', 'about'],
 * ]);
 * // { depth: 1, keys: ['dept-a', 'dept-a', 'dept-b'] }
 * ```
 */
export function derivePathClusterKeys(pagesPaths: readonly (readonly string[])[]): {
	readonly depth: number;
	readonly keys: string[];
} {
	if (pagesPaths.length === 0) return { depth: 1, keys: [] };

	// Depth-1 keys are needed unconditionally — either as the return value
	// itself (short-circuit / fallback) or as the count[1] entry for the
	// auto-cut sweep.
	const depth1Keys = pagesPaths.map((paths) => derivePathGroupKey(paths, 1));
	if (pagesPaths.length < AUTO_CUT_MIN_PAGES) {
		return { depth: 1, keys: depth1Keys };
	}

	// Distinct-key count at each candidate depth. Increments per depth:
	// count[d] − count[d − 1] — the marginal fragmentation added by going
	// one segment deeper.
	const countsPerDepth: number[] = [new Set(depth1Keys).size];
	const keysPerDepth: string[][] = [depth1Keys];
	for (let depth = 2; depth <= MAX_PATH_DEPTH; depth++) {
		const keys = pagesPaths.map((paths) => derivePathGroupKey(paths, depth));
		keysPerDepth.push(keys);
		countsPerDepth.push(new Set(keys).size);
	}
	const incrementsFromDepth2: number[] = [];
	for (let i = 1; i < countsPerDepth.length; i++) {
		incrementsFromDepth2.push((countsPerDepth[i] ?? 0) - (countsPerDepth[i - 1] ?? 0));
	}

	// autoCutThreshold picks the largest max-gap in the increments; the
	// clamp fires only in the fully-degenerate "no gap" case, in which we
	// stay at depth 1. When it finds a real gap, we pick the deepest depth
	// whose increment is still below the cut (i.e. one step before the
	// point where marginal fragmentation crosses into per-page noise).
	const cut = autoCutThreshold(incrementsFromDepth2, 1);
	if (!Number.isFinite(cut) || cut <= 0) {
		return { depth: 1, keys: depth1Keys };
	}

	let chosen = 1;
	for (const [i, element] of incrementsFromDepth2.entries()) {
		const inc = element ?? 0;
		if (inc >= cut) break;
		chosen = i + 2; // depth-2 for i=0, depth-3 for i=1, ...
	}

	return { depth: chosen, keys: keysPerDepth[chosen - 1] ?? depth1Keys };
}
