/**
 * Minimum containment fraction for cluster X to be assigned into cluster Y.
 * Containment is `|X ∩ Y| / |X|` — the fraction of X's tokens also present
 * in Y's token set. At this threshold, X is "almost a subset" of Y.
 *
 * 0.9 was chosen because the observed containment scores for genuine
 * template-subset relationships (e.g. a page missing one optional section)
 * cluster tightly between 1.000 and 0.90–0.92 on real crawl data, while
 * unrelated clusters score well below 0.8. A gap exists between ~0.92 and
 * ~0.80 in practice, so the exact value within that gap is not sensitive.
 */
const CONTAINMENT_CUTOFF = 0.9;

/**
 * One cluster's entry for containment comparison. `tokens` is the union of
 * comparison-set tokens for all pages in the cluster (Stage A uses
 * frequency-narrowed comparison sets; Stage B uses quorum cores).
 * `pageCount` is used only as a tiebreaker when containment and union size
 * are tied between two candidate targets.
 */
export type ContainedClusterEntry = {
	readonly id: number;
	readonly tokens: ReadonlySet<string>;
	readonly pageCount: number;
};

/**
 * Assigns each cluster to the "best" cluster that contains it (i.e., whose
 * token set subsumes the cluster's token union at `>= CONTAINMENT_CUTOFF`).
 * Returns a `Map<id, rootId>` — clusters not assigned to anything map to
 * themselves.
 *
 * This is a *directed* assignment (not union-find): X is absorbed by Y but Y
 * is not absorbed by X, unless Y is independently assigned elsewhere too.
 * This prevents hub-chaining: if /help/ is a structural superset of many
 * clusters (because its HTML includes every nav variant), each of those
 * clusters gets assigned to /help/, but they don't get merged with *each
 * other* — only with /help/. Confirmed on real crawl data: a pure union-find
 * approach produced a 9-cluster hub chain through one common-superset page.
 *
 * Principle: conditional rendering only *removes* elements from a template
 * (an empty section, a missing paginator) — it never adds. So a
 * conditionally-shorter page is always a structural subset of the
 * full-featured template. Confirmed on real crawl data: a 43-page works
 * cluster contained a 3-page outlier cluster at containment 1.000.
 *
 * Best target selection: highest containment → largest union size → most
 * pages. Chain resolution and cycle breaking are applied after all raw
 * assignments are computed (see the implementation).
 *
 * Cycles (mutual containment ≥ 0.9) mean the two clusters are practically
 * identical token sets. The one with the larger token set (more pages as
 * tiebreaker) becomes the root of the cycle.
 * @param clusters
 */
export function assignContainedClusters(
	clusters: readonly ContainedClusterEntry[],
): Map<number, number> {
	// Phase 1: find best raw assignment for each cluster
	const raw = new Map<number, number>();

	for (const x of clusters) {
		if (x.tokens.size === 0) continue;

		let bestTargetId = -1;
		let bestContainment = CONTAINMENT_CUTOFF - 1e-9;
		let bestUnionSize = 0;
		let bestPageCount = 0;

		for (const y of clusters) {
			if (y.id === x.id) continue;

			let intersection = 0;
			for (const token of x.tokens) {
				if (y.tokens.has(token)) intersection++;
			}
			const containment = intersection / x.tokens.size;
			if (containment < CONTAINMENT_CUTOFF) continue;

			const unionSize = x.tokens.size + y.tokens.size - intersection;
			if (
				containment > bestContainment ||
				(containment === bestContainment && unionSize > bestUnionSize) ||
				(containment === bestContainment &&
					unionSize === bestUnionSize &&
					y.pageCount > bestPageCount)
			) {
				bestContainment = containment;
				bestUnionSize = unionSize;
				bestPageCount = y.pageCount;
				bestTargetId = y.id;
			}
		}

		if (bestTargetId >= 0) {
			raw.set(x.id, bestTargetId);
		}
	}

	// Phase 2: resolve chains and cycles
	// Walk the raw assignment chain from each node; detect cycles by tracking
	// the path walked so far.
	const resolved = new Map<number, number>();
	const idToEntry = new Map(clusters.map((cl) => [cl.id, cl]));

	for (const c of clusters) {
		if (resolved.has(c.id)) continue;

		const path: number[] = [];
		const pathSet = new Set<number>();
		let current = c.id;

		// Walk until we reach a node with no further assignment or a cycle
		while (!resolved.has(current)) {
			const next = raw.get(current);
			if (next === undefined) {
				// No assignment → current is a root
				resolved.set(current, current);
				break;
			}
			if (pathSet.has(next)) {
				// Cycle detected: find the cycle members and pick the root.
				// Include `current` (the node that closed the back-edge) so it
				// participates in root selection even if it has the largest token set.
				const cycleStart = path.indexOf(next);
				const cycleIds = [...path.slice(cycleStart), current];

				// Root of the cycle: cluster with the largest token set
				// (page count as tiebreaker)
				let cycleRoot = cycleIds[0] ?? current;
				for (const id of cycleIds) {
					const bc = idToEntry.get(cycleRoot);
					const cc = idToEntry.get(id);
					const bcSize = bc?.tokens.size ?? 0;
					const ccSize = cc?.tokens.size ?? 0;
					if (ccSize > bcSize) {
						cycleRoot = id;
					} else if (ccSize === bcSize && (cc?.pageCount ?? 0) > (bc?.pageCount ?? 0)) {
						cycleRoot = id;
					}
				}

				for (const id of cycleIds) {
					resolved.set(id, cycleRoot);
				}
				// Everything before the cycle resolves to the cycle root too
				for (const id of path.slice(0, cycleStart)) {
					resolved.set(id, cycleRoot);
				}
				break;
			}
			if (resolved.has(next)) {
				// Already resolved — propagate to everything in path
				const root = resolved.get(next) ?? next;
				resolved.set(current, root);
				for (const id of path) {
					resolved.set(id, root);
				}
				break;
			}
			path.push(current);
			pathSet.add(current);
			current = next;
		}

		// If the path didn't resolve in the loop above, propagate what we know
		if (!resolved.has(c.id) && resolved.has(current)) {
			const root = resolved.get(current) ?? current;
			for (const id of path) {
				resolved.set(id, root);
			}
		}
	}

	// Ensure every cluster id has an entry (fallback to self)
	for (const c of clusters) {
		if (!resolved.has(c.id)) {
			resolved.set(c.id, c.id);
		}
	}

	return resolved;
}
