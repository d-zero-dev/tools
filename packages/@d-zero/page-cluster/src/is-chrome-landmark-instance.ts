/**
 * Default containment threshold for {@link ./is-chrome-landmark-instance.js | isChromeLandmarkInstance}.
 * Chosen to match the quorum/shell fractions used elsewhere in this pipeline
 * ({@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * `QUORUM_FRACTION`, {@link ./shell-quorum.js | SHELL_QUORUM_FALLBACK_FRACTION}) —
 * unlike those, this exact value has not been validated against real crawl
 * data; it is a starting point carried over by convention, adjustable via
 * this function's `threshold` parameter.
 */
export const DEFAULT_CHROME_OVERLAP_THRESHOLD = 0.8;

/**
 * Classifies a single landmark instance as chrome (shared site/section
 * furniture) or content, given the instance's own tokens and the shell
 * token set {@link ./shell-quorum.js | shellQuorum} discovered for its unit.
 *
 * ## Why containment (`|instance ∩ shell| / |instance|`) and not Jaccard
 *
 * `shellTokens` is the union of chrome tokens across an entire unit's
 * landmark instances (header + nav + footer + …, corpus-wide), so it is
 * usually far larger than any single instance's own token set. Jaccard's
 * denominator is the *union* of both sets, which stays shell-sized even when
 * the instance is 100% shell tokens — driving the score down regardless of
 * how purely "shell" the instance is. Containment instead asks "of this
 * instance's own tokens, how many are shell tokens", which is the question
 * that actually matters for classifying one instance.
 *
 * An instance with zero tokens is never chrome (there is nothing to
 * corroborate) — matches {@link ./per-page-landmark-signatures.js | computePerPageLandmarkInstances}'s
 * own choice to drop zero-token instances before they ever reach a
 * `PerPageLandmarkInstance`, kept here as a defensive default rather than an
 * assumption about every caller.
 * @param instanceTokens
 * @param shellTokens
 * @param threshold
 * @example
 * ```ts
 * const shellTokens = shellQuorum(unitPerPageInstances);
 * const isChrome = isChromeLandmarkInstance(instance.tokens, shellTokens);
 * ```
 */
export function isChromeLandmarkInstance(
	instanceTokens: ReadonlySet<string>,
	shellTokens: ReadonlySet<string>,
	threshold = DEFAULT_CHROME_OVERLAP_THRESHOLD,
): boolean {
	if (instanceTokens.size === 0) return false;
	let hit = 0;
	for (const token of instanceTokens) {
		if (shellTokens.has(token)) hit++;
	}
	return hit / instanceTokens.size >= threshold;
}
