/**
 * Mulberry32 — a tiny, well-known 32-bit PRNG. Chosen because it fits in a
 * closure, seeds from a single 32-bit integer (so the caller can derive it
 * deterministically from something stable like a block key), and produces a
 * uniform enough sequence for reservoir sampling. Not cryptographic; that is
 * not what this file needs.
 * @param seed
 */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d_2b_79_f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/**
 * FNV-1a 32-bit hash of a string, used as the default seed source for
 * {@link ./reservoir-sample.js | reservoirSample} when the caller passes a
 * `string` seed. Small, dependency-free, and deterministic across runs and
 * machines — the whole point of using it as a seed is that a block key like
 * `"orphan-merge:news"` always samples the same subset of members.
 * @param input
 */
function fnv1a32(input: string): number {
	let hash = 0x81_1c_9d_c5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.codePointAt(i) ?? 0;
		hash = Math.imul(hash, 0x01_00_01_93);
	}
	return hash >>> 0;
}

/**
 * Runs Algorithm R (Vitter, 1985) — the standard one-pass reservoir sampling
 * algorithm — to pick `sampleSize` items from `items`, deterministically for
 * a given `seed`. Returns them in input order.
 *
 * ## Why deterministic
 *
 * `resolvePageClusterKeys`'s cluster keys must be reproducible: given the
 * same input pages in the same order, subsequent runs must produce the same
 * cluster keys, or downstream code that stores/compares them by value
 * silently drifts across runs. `Math.random()` violates that outright.
 * Reservoir sampling on top of a seedable PRNG (see {@link ./reservoir-sample.js | mulberry32})
 * preserves determinism while retaining reservoir sampling's O(1)-space,
 * one-pass memory profile — the whole point of using it in the first place
 * (a block too large for full in-memory processing must not require
 * per-page auxiliary state for sampling either).
 *
 * ## Seed handling
 *
 * A `number` seed is used as-is; a `string` seed is hashed via
 * {@link ./reservoir-sample.js | fnv1a32} first so the caller can pass a
 * stable identifier (e.g. a block key like `"orphan-merge:news"`) without
 * having to compute a numeric hash itself. Different blocks get different
 * samples by passing each block's key as the seed.
 *
 * ## Edge cases
 *
 * - `sampleSize <= 0` — returns `[]`.
 * - `sampleSize >= items.length` — returns all of `items` in input order,
 *   without invoking the PRNG. This matters for regression: a block small
 *   enough to fit its whole membership in the sample must not have items
 *   reordered by any sampling logic, so downstream cluster labels stay in
 *   the same first-seen order as the in-memory path.
 * @param items
 * @param sampleSize
 * @param seed
 * @example
 * ```ts
 * const sample = reservoirSample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 'block-a');
 * // deterministic 3-item subset, always the same for seed 'block-a'
 * ```
 */
export function reservoirSample<T>(
	items: readonly T[],
	sampleSize: number,
	seed: number | string = 0,
): T[] {
	if (!(Number.isInteger(sampleSize) && sampleSize >= 0)) {
		throw new RangeError(
			`reservoirSample: sampleSize must be a non-negative integer, got ${sampleSize}`,
		);
	}
	if (sampleSize === 0 || items.length === 0) return [];
	if (sampleSize >= items.length) return [...items];

	const numericSeed = typeof seed === 'string' ? fnv1a32(seed) : seed >>> 0;
	const rand = mulberry32(numericSeed);

	// Reservoir holds the picked positions (indices into `items`); we return
	// items sorted by those positions to preserve input order in the result.
	const reservoirIndices: number[] = Array.from({ length: sampleSize }, (_, i) => i);

	for (let i = sampleSize; i < items.length; i++) {
		const j = Math.floor(rand() * (i + 1));
		if (j < sampleSize) {
			reservoirIndices[j] = i;
		}
	}

	reservoirIndices.sort((a, b) => a - b);
	return reservoirIndices.map((position) => items[position] as T);
}
