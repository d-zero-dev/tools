import type { PageBlockingSignals } from './resolve-blocking-group-keys.js';

import { derivePathGroupKey } from './derive-path-group-key.js';

/**
 * Prefix distinguishing a reassigned key from the `css:`/`path:` keys
 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys} itself
 * produces, so the two families can never collide. Exported so
 * {@link ./pass0-blocking.js | resolveBlockKeys} can recover the confined
 * path key back out of a reassigned block key when building `BlockingReason`s,
 * without duplicating this literal.
 */
export const REASSIGNED_KEY_PREFIX = 'orphan-merge:';

/**
 * Reads `values[index]`, throwing instead of returning `undefined`. Every
 * call site here indexes `pages`/`pathKeys`/`blockKeys` with a position
 * derived from one of those same arrays' own `.entries()` or `.map()`, so the
 * thrown branch is unreachable in practice; it exists to satisfy
 * `noUncheckedIndexedAccess` without a non-null assertion (same rationale as
 * `requireIndex` in `resolve-page-cluster-keys.ts` and
 * `resolve-structural-cluster-keys.ts`, each kept as an independent copy for
 * the same reason those two are).
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('reassignOrphanBlockKeys: index out of bounds');
	}
	return value;
}

/**
 * Rewrites the `path:`-fallback key of an "orphan" page — one with no
 * stylesheet references recorded at all — to match a same-URL-section `css:`
 * key, when one exists that is itself confined to that same section.
 *
 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys} commits
 * every page to exactly one key: a page with zero stylesheet references can
 * never produce a `css:` candidate, so it always falls back to `path:`, even
 * when every other page of the same template loaded a distinctive stylesheet
 * and landed on a shared `css:` key instead. That function's own JSDoc notes
 * a literal OR-merge (letting a page carry both candidates) is deliberately
 * deferred — but a literal OR-merge would not even apply here, since an
 * orphan never had a `css:` candidate to OR with in the first place. This is
 * a narrower, targeted fix for that specific gap, confirmed against a crawl
 * (nitpicker) where a subset of same-template pages were missing stylesheet
 * data entirely (a crawl-completeness gap, not a `resolveBlockingGroupKeys`
 * logic error) and fragmented away from the rest of their template's `css:`
 * block as a result.
 *
 * A `css:` block is only treated as a merge target when *every* one of its
 * members shares the orphan's `derivePathGroupKey` value ("confined" to that
 * section) — a `css:` block spanning multiple sections (e.g. a shared
 * cross-department template) is left untouched, since there is no single
 * section to merge it into. Non-orphan pages sharing the orphan's `path:` key
 * (pages with a stylesheet set that was genuinely non-discriminative, not
 * merely unrecorded) are deliberately left out of the rewritten key: complete-
 * linkage clustering's min-linkage aggregation means a third point entering a
 * comparison pool can change whether two *other* points end up merged (e.g.
 * two pages at a pairwise similarity just above threshold can fail to merge
 * once a third, more tightly-matching point joins the pool and "uses up" one
 * of them first) — see this function's spec for a worked example. Folding in
 * only the confirmed orphans, not the whole `path:` bucket, keeps this
 * function from perturbing clustering decisions for pages it has no evidence
 * about.
 *
 * Does not itself compare page content: it only decides which pages should
 * be pooled together for {@link ./resolve-structural-cluster-keys.js |
 * resolveStructuralClusterKeys} to adjudicate (via
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}'s existing
 * per-key grouping, unchanged) — an orphan folded into a `css:` block's pool
 * still ends up in its own singleton cluster if its content doesn't actually
 * match.
 *
 * A known, accepted trade-off: "confined" is checked against `pathKey` alone
 * (the same coarse granularity `pathDepth` already gives `path:` keys), so
 * multiple genuinely-different-template `css:` blocks that merely happen to
 * share one broad URL section (e.g. everything under a large sub-site's
 * top-level segment) get pooled into the *same* `resolveStructuralClusterKeys`
 * call as each other, not just alongside the orphan that triggered the merge.
 * Confirmed on real crawl data (8,936 pages): this correctly reunited an
 * orphan with a 1,008-page same-template cluster it had been split from, and
 * the corpus's cluster count improved net (1,984 → 1,972) — but as a side
 * effect, 15 small clusters *unrelated* to any orphan (all inside one very
 * large, already-confined `css:` block spanning a whole sub-site) came out
 * differently than they would have without this option, because the extra
 * pages pooled alongside them changed the NN-chain merge order (the same
 * mechanism described above, just triggered by the pooling itself rather
 * than by admitting a non-orphan page). A companion real-site run (302 pages)
 * showed zero change. Narrowing "confined" to reduce this blast radius (e.g.
 * preferring the `css:` block closest in size to the orphan count when
 * several share a `pathKey`) is possible future work, not yet justified
 * without more real-corpus evidence of it mattering in practice.
 * @param pages
 * @param blockKeys
 * @param pathDepth
 * @example
 * ```ts
 * const pages = [
 * 	{ paths: ['news', '1'], stylesheetHrefs: ['https://example.com/a.css'] },
 * 	{ paths: ['news', '2'], stylesheetHrefs: ['https://example.com/a.css'] },
 * 	{ paths: ['news', '3'], stylesheetHrefs: [] }, // same template, but crawl missed its <link>
 * 	{ paths: ['about'], stylesheetHrefs: ['https://example.com/b.css'] },
 * ];
 * const blockKeys = resolveBlockingGroupKeys(pages);
 * // ['css:<hash of a.css>', 'css:<hash of a.css>', 'path:news', 'path:about']
 * reassignOrphanBlockKeys(pages, blockKeys);
 * // ['orphan-merge:news', 'orphan-merge:news', 'orphan-merge:news', 'path:about']
 * ```
 */
export function reassignOrphanBlockKeys(
	pages: readonly PageBlockingSignals[],
	blockKeys: readonly string[],
	pathDepth?: number,
): string[] {
	// Eagerly delegate pathDepth validation to derivePathGroupKey, instead of
	// only discovering an invalid option once some page's data happens to
	// reach that branch below — mirrors resolveBlockingGroupKeys's own eager
	// `derivePathGroupKey([], pathDepth)` call, so this function fails fast
	// on the same invalid input even when `pages` is empty.
	derivePathGroupKey([], pathDepth);

	const pathKeys = pages.map((page) => derivePathGroupKey(page.paths, pathDepth));
	const isOrphan = (index: number): boolean =>
		requireIndex(blockKeys, index).startsWith('path:') &&
		requireIndex(pages, index).stylesheetHrefs.length === 0;

	const cssMemberIndicesByKey = new Map<string, number[]>();
	for (const [index, blockKey] of blockKeys.entries()) {
		if (blockKey.startsWith('css:')) {
			const indices = cssMemberIndicesByKey.get(blockKey);
			if (indices) {
				indices.push(index);
			} else {
				cssMemberIndicesByKey.set(blockKey, [index]);
			}
		}
	}

	// A css: block is a merge target for pathKey `p` only when every one of
	// its members shares `p` — collected as a single confined pathKey per
	// block (or left unset if the block spans more than one).
	const confinedPathKeyByCssKey = new Map<string, string>();
	for (const [cssKey, indices] of cssMemberIndicesByKey) {
		const candidatePathKey = requireIndex(pathKeys, requireIndex(indices, 0));
		if (indices.every((index) => requireIndex(pathKeys, index) === candidatePathKey)) {
			confinedPathKeyByCssKey.set(cssKey, candidatePathKey);
		}
	}

	const pathKeysWithConfinedCssBlock = new Set(confinedPathKeyByCssKey.values());

	const orphanPathKeys = new Set<string>();
	for (const index of blockKeys.keys()) {
		const pathKey = requireIndex(pathKeys, index);
		if (isOrphan(index) && pathKeysWithConfinedCssBlock.has(pathKey)) {
			orphanPathKeys.add(pathKey);
		}
	}

	if (orphanPathKeys.size === 0) {
		return [...blockKeys];
	}

	return blockKeys.map((blockKey, index) => {
		const pathKey = requireIndex(pathKeys, index);
		if (!orphanPathKeys.has(pathKey)) {
			return blockKey;
		}

		const isConfinedCssMember = confinedPathKeyByCssKey.get(blockKey) === pathKey;
		return isOrphan(index) || isConfinedCssMember
			? `${REASSIGNED_KEY_PREFIX}${pathKey}`
			: blockKey;
	});
}
