import type { ContentDepthLandmark } from './cap-content-depth.js';
import type { ResolveStructuralClusterKeysOptions } from './resolve-structural-cluster-keys.js';
import type { TokenizeOptions } from './types.js';

import { capContentDepth } from './cap-content-depth.js';
import { resolveStructuralClusterKeys } from './resolve-structural-cluster-keys.js';
import { tokenize } from './tokenize.js';

/**
 * @see detectContentDepthCap
 */
export type DetectContentDepthCapOptions = TokenizeOptions &
	ResolveStructuralClusterKeysOptions & {
		/** Forwarded to {@link ./cap-content-depth.js | capContentDepth}. Defaults to `'main'`. */
		landmark?: ContentDepthLandmark;
		/**
		 * Depths to try, in strictly ascending order (`RangeError` otherwise —
		 * the knee-detection loop below assumes each depth is deeper than the
		 * last). Defaults to `[1, 2, 3, 4, 5, 6, 8, 10]` — chosen to cover the
		 * range confirmed on real crawl data (the knee landed at 3 on both
		 * corpora checked) with a few extra steps past it to confirm the
		 * explosion is sustained, without trying every single depth up to an
		 * arbitrary ceiling.
		 */
		candidateDepths?: readonly number[];
		/**
		 * The minimum cluster-count ratio between two consecutive candidate
		 * depths (`clusterCount[i] / clusterCount[i-1]`) required to call that
		 * jump "the knee." Must be a finite number greater than 1 (`RangeError`
		 * otherwise — a ratio at or below 1 means "no growth," which can never
		 * meaningfully gate a knee). Defaults to `1.5` (a 50% jump). Below this,
		 * growth is treated as gradual/expected rather than evidence of a
		 * freeform-content boundary, and no cap is recommended.
		 */
		minKneeRatio?: number;
	};

/**
 * Finds the depth just before {@link ./cap-content-depth.js | capContentDepth}
 * ("`maxDepth`") would start throwing away real structural signal, by trying
 * each of `options.candidateDepths` in turn and looking for the first big
 * jump in resulting cluster count.
 *
 * Confirmed on two unrelated real crawls (302 and ~4,100 pages, sharing no
 * code or template lineage): the number of distinct
 * {@link ./resolve-structural-cluster-keys.js | resolveStructuralClusterKeys}
 * clusters stays roughly flat (or grows gently) as `maxDepth` increases,
 * then jumps sharply (14x and 9x respectively) at one specific depth — the
 * point past which comparisons start seeing freeform, page-to-page-varying
 * editorial content instead of shared template structure. That depth landed
 * at 3 on both corpora, but this function doesn't hardcode that: it
 * re-derives it per corpus, so a differently-nested template doesn't get
 * the wrong number silently baked in.
 *
 * Returns the *last* candidate depth before the biggest qualifying jump
 * (`options.minKneeRatio` or steeper) — i.e. the depth to actually cap
 * at, already chosen so the jump lands past it. If no jump in
 * `candidateDepths` clears `minKneeRatio` (growth looks gradual, or
 * `htmlList` is too small/uniform to tell), the *largest* candidate depth is
 * returned — deliberately not capping rather than guessing.
 *
 * Forwards `options`' `TokenizeOptions`/`ResolveStructuralClusterKeysOptions`
 * fields (e.g. `filterNoiseClasses`, `similarityThreshold`) to every sweep's
 * `tokenize`/`resolveStructuralClusterKeys` call, so the knee is detected
 * against the same tokenization and clustering configuration
 * {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys} actually
 * clusters with afterward — passing a different configuration here than
 * downstream would pick a cap tuned for a comparison that's never actually
 * performed.
 *
 * This calls {@link ./resolve-structural-cluster-keys.js |
 * resolveStructuralClusterKeys} once per candidate depth (each an O(n²)
 * comparison over `htmlList`), so cost scales with both `htmlList.length`
 * and `candidateDepths.length`. Measured on a real 4,085-page single-section
 * corpus: ~4s per candidate depth, ~30s total for the default 8 depths.
 * Measured via {@link ./resolve-page-cluster-keys.js | resolvePageClusterKeys}'s
 * `autoCapMainDepth` option on a real 8,936-page whole-site corpus (this
 * function runs once, globally, across all of it before blocking): ~5m50s
 * total, versus ~16s for the same corpus without `autoCapMainDepth` —
 * cutting that corpus's final cluster count from 1,972 to 283. Sampling
 * `htmlList` down before calling this (accepting a less precise knee
 * estimate) is the natural next step if this cost becomes a problem, but
 * isn't implemented here without real evidence it's needed.
 * @param htmlList
 * @param options
 * @example
 * ```ts
 * const maxDepth = detectContentDepthCap(pages.map((p) => p.html));
 * const tokenSets = pages.map(
 * 	(p) => new Set(tokenize(capContentDepth(p.html, { landmark: 'main', maxDepth }).remainderHtml).tokens),
 * );
 * ```
 */
export function detectContentDepthCap(
	htmlList: readonly string[],
	options?: DetectContentDepthCapOptions,
): number {
	const landmark = options?.landmark ?? 'main';
	const candidateDepths = options?.candidateDepths ?? [1, 2, 3, 4, 5, 6, 8, 10];
	const minKneeRatio = options?.minKneeRatio ?? 1.5;

	if (candidateDepths.length === 0) {
		throw new RangeError('detectContentDepthCap: candidateDepths must not be empty');
	}
	let previousDepth = -Infinity;
	for (const depth of candidateDepths) {
		if (depth <= previousDepth) {
			throw new RangeError(
				`detectContentDepthCap: candidateDepths must be in strictly ascending order, got ${JSON.stringify(candidateDepths)}`,
			);
		}
		previousDepth = depth;
	}
	if (!(Number.isFinite(minKneeRatio) && minKneeRatio > 1)) {
		throw new RangeError(
			`detectContentDepthCap: minKneeRatio must be a finite number greater than 1, got ${minKneeRatio}`,
		);
	}

	const clusterCounts = candidateDepths.map((maxDepth) => {
		const tokenSets = htmlList.map((html) => {
			const capped = capContentDepth(html, { landmark, maxDepth }).remainderHtml;
			return new Set(tokenize(capped, options).tokens);
		});
		return new Set(resolveStructuralClusterKeys(tokenSets, options)).size;
	});

	// bestRatio starts below any possible ratio (rather than at minKneeRatio
	// itself) so a jump that exactly *meets* minKneeRatio still qualifies —
	// this option's own JSDoc only calls growth "gradual" (i.e. rejected)
	// when it's *below* the threshold, not at or above it.
	let bestRatio = -Infinity;
	let kneeIndex = -1;
	for (let i = 1; i < clusterCounts.length; i++) {
		const previous = clusterCounts[i - 1];
		const current = clusterCounts[i];
		if (previous === undefined || current === undefined || previous === 0) {
			continue;
		}
		const ratio = current / previous;
		if (ratio >= minKneeRatio && ratio > bestRatio) {
			bestRatio = ratio;
			kneeIndex = i;
		}
	}

	if (kneeIndex === -1) {
		return candidateDepths.at(-1) ?? 0;
	}
	return candidateDepths[kneeIndex - 1] ?? 0;
}
