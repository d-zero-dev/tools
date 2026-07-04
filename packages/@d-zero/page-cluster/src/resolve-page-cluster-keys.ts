import type { ResolveBlockingGroupKeysOptions } from './resolve-blocking-group-keys.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';

import { resolveBlockingGroupKeys } from './resolve-blocking-group-keys.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';

/**
 * Reads `values[index]`, throwing instead of returning `undefined`. Every
 * call site here indexes with a position this function generated itself
 * (an entry from `Map#entries()`/`Array#entries()` over an array it just
 * built), so the thrown branch is unreachable in practice; it exists to
 * satisfy `noUncheckedIndexedAccess` without a non-null assertion. Not
 * imported from `resolve-structural-cluster-keys.ts`'s own copy: that file's
 * `export`s are its intended public API surface, and this ~7-line generic
 * helper isn't worth carving an exception into that boundary for (same
 * rationale as `readDpValue` in `array-edit-distance.ts` being its own
 * independent copy rather than a shared import).
 * @param values
 * @param index
 */
function requireIndex<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error('resolvePageClusterKeys: index out of bounds');
	}
	return value;
}

/**
 * Per-page input to {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}:
 * the blocking signals {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * needs, plus the page's own tokenized structure
 * ({@link ./tokenize.js | tokenize}'s `.tokens`, turned into a `Set`).
 */
export type PageClusterSignals = {
	paths: readonly string[];
	stylesheetHrefs: readonly string[];
	tokens: ReadonlySet<string>;
};

/**
 * @see resolvePageClusterKeys
 */
export type ResolvePageClusterKeysOptions = ResolveBlockingGroupKeysOptions &
	ResolveStructuralClusterKeysOptions;

/**
 * Connects the two stages this package otherwise leaves for the caller to
 * wire together: {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}
 * (coarse blocking by URL path or stylesheet set) and
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * (exact structural clustering *within* one block). Returns one final key
 * per page, in the same order as `pages`, unique across the whole input —
 * not just within a block.
 *
 * `resolveStructuralClusterKeys` numbers its clusters `cluster:0`,
 * `cluster:1`, ... independently every time it's called, so two different
 * blocks' `cluster:0` are unrelated but identically named. Composing the
 * block key and the per-block cluster label via `JSON.stringify` (rather
 * than plain string concatenation, e.g. a `::` separator) rules out
 * collisions regardless of what either half happens to contain, without
 * depending on `resolveStructuralClusterKeys`'s label format never changing.
 * @param pages
 * @param options
 * @example
 * ```ts
 * resolvePageClusterKeys([
 * 	{ paths: ['news', '1'], stylesheetHrefs: [], tokens: new Set(['body>article']) },
 * 	{ paths: ['news', '2'], stylesheetHrefs: [], tokens: new Set(['body>article']) },
 * 	{ paths: ['about'], stylesheetHrefs: [], tokens: new Set(['body>section']) },
 * ]);
 * // pages 0 and 1 (same block, same structure) share a key; page 2 (different block) gets its own
 * ```
 */
export function resolvePageClusterKeys(
	pages: readonly PageClusterSignals[],
	options?: ResolvePageClusterKeysOptions,
): string[] {
	const blockKeys = resolveBlockingGroupKeys(pages, options);

	const indicesByBlockKey = new Map<string, number[]>();
	for (const [index, blockKey] of blockKeys.entries()) {
		const indices = indicesByBlockKey.get(blockKey);
		if (indices) {
			indices.push(index);
		} else {
			indicesByBlockKey.set(blockKey, [index]);
		}
	}

	const finalKeys: string[] = Array.from({ length: pages.length });
	for (const [blockKey, indices] of indicesByBlockKey) {
		const blockTokenSets = indices.map((index) => requireIndex(pages, index).tokens);
		const localLabels = resolveStructuralClusterKeys(blockTokenSets, options);

		for (const [position, index] of indices.entries()) {
			finalKeys[index] = JSON.stringify([blockKey, requireIndex(localLabels, position)]);
		}
	}

	return finalKeys;
}
