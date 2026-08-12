import type { MirrorAxis } from './detect-mirror-axis.js';

import { jaccardSimilarity } from './jaccard-similarity.js';
import { normalizeHrefByMirrorAxis } from './normalize-href-by-mirror-axis.js';
import { normalizePathByMirrorAxis } from './normalize-path-by-mirror-axis.js';

/**
 * A page as {@link findCrossClusterDuplicates} and
 * {@link ./validate-cluster-partition.js | validateClusterPartition} need
 * it: already tokenized (no re-tokenization here — a caller validating a
 * result from {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}
 * already has these token sets on hand) and carrying the blocking-relevant
 * signals ({@link ./resolve-page-cluster-keys.js | PageClusterSignals}'s
 * `paths`/`stylesheetHrefs`) needed to corroborate a match against a
 * {@link MirrorAxis}.
 */
export type ClusteredPage = {
	readonly clusterKey: string;
	readonly tokens: ReadonlySet<string>;
	readonly paths: readonly string[];
	readonly stylesheetHrefs: readonly string[];
};

/**
 * Similarity required for a page pair below exact match to be accepted —
 * only once axis+href corroboration also holds (see
 * {@link findCrossClusterDuplicates}'s JSDoc). Matches the 80% floor already
 * used throughout this package's Stage B for corroborating a secondary
 * signal ({@link ./merge-cross-block-clusters.js | CROSS_BLOCK_THRESHOLD},
 * `SHELL_CORROBORATION_THRESHOLD`) rather than carrying a decision alone.
 */
const DEFAULT_CORROBORATED_SIMILARITY_THRESHOLD = 0.8;

/**
 * Options for {@link findCrossClusterDuplicates}.
 */
export type FindCrossClusterDuplicatesOptions = {
	/**
	 * A `MirrorAxis` to corroborate near-duplicate (similarity `< 1`) pairs
	 * against. Omitting it (or passing `null`) still finds exact-duplicate
	 * pairs — see {@link findCrossClusterDuplicates}'s JSDoc — just without
	 * the near-duplicate pass, and every result's `corroboratedByMirrorAxis`
	 * is `false` (corroboration was never attempted, not disproven).
	 */
	readonly mirrorAxis?: MirrorAxis | null;
	/** @see DEFAULT_CORROBORATED_SIMILARITY_THRESHOLD */
	readonly corroboratedSimilarityThreshold?: number;
};

/**
 * One pair of clusters found to plausibly be the same template, split by
 * the clustering run under review.
 */
export type CrossClusterDuplicate = {
	/** The two cluster keys, ordered so `clusterKeyA < clusterKeyB` (stable regardless of input order). */
	readonly clusterKeyA: string;
	readonly clusterKeyB: string;
	/** The highest pairwise token-set Jaccard similarity found between the two clusters' members. */
	readonly similarity: number;
	/**
	 * Whether the best-similarity pair was also corroborated by the mirror
	 * axis (same axis-normalized path shape and axis-normalized stylesheet
	 * href set). Always `false` when no axis was supplied. `similarity === 1`
	 * pairs are reported regardless of this flag — see this function's JSDoc.
	 */
	readonly corroboratedByMirrorAxis: boolean;
};

/**
 * @param tokens
 */
function exactHashKey(tokens: ReadonlySet<string>): string {
	return [...tokens].toSorted().join(' ');
}

/**
 * @param a
 * @param b
 * @param axis
 */
function hrefsMatchUnderAxis(
	a: ClusteredPage,
	b: ClusteredPage,
	axis: MirrorAxis,
): boolean {
	const normalize = (hrefs: readonly string[]): string =>
		[...new Set(hrefs.map((h) => normalizeHrefByMirrorAxis(h, axis)))]
			.toSorted()
			.join(' ');
	return normalize(a.stylesheetHrefs) === normalize(b.stylesheetHrefs);
}

/**
 * Best-similarity-so-far table, keyed by `[clusterKeyA][clusterKeyB]` with
 * keys always inserted in canonical (`a < b`) order — a nested `Map` rather
 * than a single `Map` joined-string key, so cluster keys containing
 * arbitrary characters (including whitespace) can never collide or
 * mis-split.
 */
type BestByClusterPair = Map<
	string,
	Map<string, { similarity: number; corroboratedByMirrorAxis: boolean }>
>;

/**
 * @param best
 * @param a
 * @param b
 * @param similarity
 * @param axis
 */
function recordCandidate(
	best: BestByClusterPair,
	a: ClusteredPage,
	b: ClusteredPage,
	similarity: number,
	axis: MirrorAxis | null,
): void {
	if (a.clusterKey === b.clusterKey) return;
	const [keyA, keyB] =
		a.clusterKey < b.clusterKey
			? [a.clusterKey, b.clusterKey]
			: [b.clusterKey, a.clusterKey];
	const corroborated = axis !== null && hrefsMatchUnderAxis(a, b, axis);

	let inner = best.get(keyA);
	if (!inner) {
		inner = new Map();
		best.set(keyA, inner);
	}
	const existing = inner.get(keyB);
	if (!existing || similarity > existing.similarity) {
		inner.set(keyB, { similarity, corroboratedByMirrorAxis: corroborated });
	} else if (
		similarity === existing.similarity &&
		corroborated &&
		!existing.corroboratedByMirrorAxis
	) {
		inner.set(keyB, { similarity, corroboratedByMirrorAxis: true });
	}
}

/**
 * Finds pairs of clusters whose members are plausibly the same template,
 * split apart by the clustering run under review — the signal a caller acts
 * on to merge them back (see {@link ./merge-validated-clusters.js |
 * mergeValidatedClusters}).
 *
 * Two passes, both bounded well below the full `O(pageCount²)` cross
 * product:
 *
 * 1. **Exact match** — pages are grouped by an exact hash of their token
 *    set (`O(pageCount)`). Any hash group spanning more than one cluster key
 *    is an instant duplicate at `similarity: 1`: two pages whose structural
 *    tokens are byte-identical being in different clusters is a partition
 *    error regardless of *why* — no corroboration is required or checked
 *    for acceptance (an axis check still runs on the pair, if one was
 *    supplied, purely to populate `corroboratedByMirrorAxis` informationally).
 *    Pages with an empty token set are excluded — no structural evidence to
 *    match on.
 * 2. **Axis-corroborated near match** (only when `options.mirrorAxis` is
 *    given) — pages are grouped by
 *    {@link ./normalize-path-by-mirror-axis.js | normalizePathByMirrorAxis}
 *    shape, which is naturally small per group (bounded by how many mirror
 *    values recur under that shape, not by corpus size). Within a shape
 *    group spanning more than one cluster key, every cross-cluster pair is
 *    compared directly; a pair clearing `corroboratedSimilarityThreshold`
 *    **and** matching under
 *    {@link ./normalize-href-by-mirror-axis.js | normalizeHrefByMirrorAxis}
 *    is accepted. Both signals are required here — same path shape alone
 *    can recur by coincidence (two different templates that happen to sit at
 *    the same depth), and same stylesheet shape alone doesn't imply the same
 *    DOM structure.
 *
 * Results are deduplicated to one entry per cluster-key pair, keeping the
 * highest similarity found and OR-ing the corroboration flag across every
 * qualifying page pair for that cluster pair.
 * @param pages
 * @param options
 * @example
 * ```ts
 * const duplicates = findCrossClusterDuplicates(pages, { mirrorAxis: axis });
 * const safeToMerge = duplicates.filter((d) => d.similarity === 1 || d.corroboratedByMirrorAxis);
 * ```
 */
export function findCrossClusterDuplicates(
	pages: readonly ClusteredPage[],
	options?: FindCrossClusterDuplicatesOptions,
): readonly CrossClusterDuplicate[] {
	const axis = options?.mirrorAxis ?? null;
	const threshold =
		options?.corroboratedSimilarityThreshold ?? DEFAULT_CORROBORATED_SIMILARITY_THRESHOLD;

	const best: BestByClusterPair = new Map();

	// Pass 1: exact match via hash grouping.
	const byExactHash = new Map<string, ClusteredPage[]>();
	for (const page of pages) {
		if (page.tokens.size === 0) continue;
		const key = exactHashKey(page.tokens);
		const group = byExactHash.get(key);
		if (group) group.push(page);
		else byExactHash.set(key, [page]);
	}
	for (const group of byExactHash.values()) {
		if (new Set(group.map((p) => p.clusterKey)).size < 2) continue;
		for (let a = 0; a < group.length; a++) {
			for (let b = a + 1; b < group.length; b++) {
				recordCandidate(best, group[a]!, group[b]!, 1, axis);
			}
		}
	}

	// Pass 2: axis-corroborated near match, scoped to same axis-normalized shape.
	if (axis !== null) {
		const byShape = new Map<string, ClusteredPage[]>();
		for (const page of pages) {
			const shape = normalizePathByMirrorAxis(page.paths, axis);
			const group = byShape.get(shape);
			if (group) group.push(page);
			else byShape.set(shape, [page]);
		}
		for (const group of byShape.values()) {
			if (new Set(group.map((p) => p.clusterKey)).size < 2) continue;
			for (let a = 0; a < group.length; a++) {
				for (let b = a + 1; b < group.length; b++) {
					const pageA = group[a]!;
					const pageB = group[b]!;
					if (pageA.clusterKey === pageB.clusterKey) continue;
					const similarity = jaccardSimilarity(pageA.tokens, pageB.tokens);
					if (similarity < threshold) continue;
					if (!hrefsMatchUnderAxis(pageA, pageB, axis)) continue;
					recordCandidate(best, pageA, pageB, similarity, axis);
				}
			}
		}
	}

	const results: CrossClusterDuplicate[] = [];
	for (const [clusterKeyA, inner] of best) {
		for (const [clusterKeyB, { similarity, corroboratedByMirrorAxis }] of inner) {
			results.push({ clusterKeyA, clusterKeyB, similarity, corroboratedByMirrorAxis });
		}
	}
	return results;
}
