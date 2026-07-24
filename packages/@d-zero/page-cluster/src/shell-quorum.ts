import type { PerPageLandmarkInstance } from './per-page-landmark-signatures.js';

import { autoCutThreshold } from './auto-cut-threshold.js';

/**
 * Fallback clamp for {@link ./auto-cut-threshold.js | autoCutThreshold} when
 * run on the per-landmark-instance token-frequency distribution in
 * {@link ./shell-quorum.js | shellQuorum}. Independently tunable from
 * `merge-cross-block-clusters.ts`'s own `QUORUM_FRACTION` (same value today,
 * 0.8, by coincidence of both having been validated against the same real
 * crawl corpora — not because the two are meant to move together).
 */
const SHELL_QUORUM_FALLBACK_FRACTION = 0.8;

/**
 * Discovers a unit's shell tokens by auto-cutting the per-*token* page-
 * frequency histogram of every landmark instance's tokens. This is the same
 * max-gap primitive used for Stage A merge-height cutoffs, applied
 * recursively at the landmark-token layer.
 *
 * ## Why per-token and not per-signature
 *
 * An earlier iteration ran the histogram at the level of full landmark-
 * instance signatures (canonicalized token sets). That failed on a real,
 * common pattern: a shared site chrome whose markup carries a per-page
 * distinguishing element (a breadcrumb, a page-title element with a page-
 * specific class, a "current" state). All pages have most of the same
 * tokens, but every page's full signature is distinct because tokens embed
 * class names. Per-signature counting saw 5 signatures at freq 0.2 each,
 * autoCutThreshold on the flat distribution returned the clamp, and the
 * shell collapsed to empty even though every page shared the core header
 * skeleton. Per-token counting handles the same case correctly — the shared
 * skeleton tokens each hit freq 1.0.
 *
 * ## The histogram
 *
 * For every member page, all its landmark instances are tokenized and
 * unioned into a single per-page token set (order-agnostic, deduped: a
 * token appearing in two of the page's landmarks still counts once for
 * that page). The corpus histogram is then "how many pages contain each
 * token". Tokens that appear on nearly every page are the unit's chrome;
 * tokens that appear on only a handful are page-specific content that
 * happens to be tagged as a landmark.
 *
 * ## Why auto-cut instead of a hard-coded quorum
 *
 * A fixed 80% quorum (this file's earlier implementation) baked one
 * threshold in for every unit. Real corpora don't obey a universal cutoff:
 * a section-local landmark token that appears on 60% of a unit's pages is
 * the section's chrome under any reasonable reading, but 80% quorum
 * discards it. Auto-cut looks at the *shape* of the frequency distribution
 * and picks the widest gap between adjacent frequencies — if the
 * distribution is `{1.00, 1.00, 0.65, 0.03, 0.02}`, the gap between 0.65
 * and 0.03 (0.62) dwarfs everything else and the cut lands mid-gap around
 * 0.34, correctly grouping the 0.65 tokens with the site-wide 1.00 ones as
 * "chrome for this unit". If instead the distribution is flat, the clamp
 * to {@link SHELL_QUORUM_FALLBACK_FRACTION} keeps the threshold from being
 * tighter than the fallback default.
 *
 * ## Fallbacks
 *
 * A single distinct token (`heights.length < 2`) or a perfectly flat
 * distribution (`maxGap === 0`) returns the
 * {@link SHELL_QUORUM_FALLBACK_FRACTION} clamp verbatim — exactly the same
 * 80%-quorum behavior as before. So degenerate cases degrade to the old
 * contract; only richer distributions get the auto-cut benefit.
 *
 * A page with no landmarks contributes an empty set, deliberately, so the
 * shell-corroboration jaccard between two landmark-less pages is 0 rather
 * than 1 (which it would be if we handed back a `<body></body>`-derived
 * `{body}` fallback set to both sides).
 *
 * ## Reuse
 *
 * Originally private to {@link ./merge-cross-block-clusters.js | mergeCrossBlockClusters}'s
 * Stage B L2 corroboration; exported from its own module so
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeysInMemory}'s
 * `includeLandmarkPositions` reporting path can run it once per final
 * cluster to classify individual landmark instances as chrome (see
 * {@link ./is-chrome-landmark-instance.js | isChromeLandmarkInstance}).
 * @param perPageInstances
 */
export function shellQuorum(
	perPageInstances: readonly (readonly PerPageLandmarkInstance[])[],
): ReadonlySet<string> {
	const pageCount = perPageInstances.length;
	if (pageCount === 0) return new Set();

	// Union all instance token sets per page (dedupe within page: a token
	// present on both header and footer of the same page still counts once
	// for that page's contribution).
	const tokenPageCount = new Map<string, number>();
	for (const instances of perPageInstances) {
		const perPageUnion = new Set<string>();
		for (const inst of instances) {
			for (const token of inst.tokens) perPageUnion.add(token);
		}
		for (const token of perPageUnion) {
			tokenPageCount.set(token, (tokenPageCount.get(token) ?? 0) + 1);
		}
	}

	if (tokenPageCount.size === 0) return new Set();

	const frequencies: number[] = [];
	for (const count of tokenPageCount.values()) {
		frequencies.push(count / pageCount);
	}

	const cut = autoCutThreshold(frequencies, SHELL_QUORUM_FALLBACK_FRACTION);

	const shell = new Set<string>();
	for (const [token, count] of tokenPageCount) {
		if (count / pageCount >= cut) shell.add(token);
	}
	return shell;
}
