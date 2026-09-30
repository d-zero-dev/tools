import type { StageALineageEntry } from './stage-a-lineage.js';

import { areStageASeparated } from './are-stage-a-separated.js';
import { jaccardSimilarity } from './jaccard-similarity.js';

/**
 * How many core tokens each side must have that the other lacks before the
 * two count as different templates rather than one being a conditionally
 * shorter render of the other. Conditional rendering only removes elements,
 * so the shorter side's exclusive count is 0 or 1 (`assign-contained-clusters`
 * documents a 43-page cluster containing a 3-page outlier at containment
 * 1.000); two templates that share a shell but differ in body each keep a
 * few tokens of their own.
 */
export const MIN_EXCLUSIVE_TOKENS = 2;

/**
 * What {@link filterMergesByStageASeparation} needs from the round it runs in.
 */
export type StageASeparationContext = {
	/** This round's quorum core per group key. */
	readonly cores: ReadonlyMap<string, ReadonlySet<string>>;
	/** The same cores with class names stripped (see `shapeToken`). */
	readonly shapedCores: ReadonlyMap<string, ReadonlySet<string>>;
	/** Every current group's Stage-A lineage. Read-only here. */
	readonly lineageByRoot: ReadonlyMap<string, readonly StageALineageEntry[]>;
	/** The fine stage's complete-linkage threshold on raw cores. */
	readonly threshold: number;
	/** The fine stage's shape-Jaccard threshold. */
	readonly shapeThreshold: number;
};

/**
 * The path of a token's parent element: everything before its last `>`.
 * @param token
 */
function parentPath(token: string): string {
	return token.slice(0, Math.max(0, token.lastIndexOf('>')));
}

/**
 * How many tokens `a` has that `b` lacks *and* that belong to a subtree `b`
 * does not render at all. A token `a` has and `b` lacks whose parent element
 * also carries some token of `b` is the same component rendered in another
 * state — a pager whose first page has `.current` and `a.next` but no
 * `.prev`, a calendar with or without a "next month" link — not a different
 * template. On a real crawl, two such pager states (tens and hundreds of
 * pages of one list) each had four exclusive tokens, every one of them under
 * a container both sides render; list-versus-detail templates keep tokens under
 * containers the other side has no counterpart for.
 * @param a
 * @param b
 */
function countStructuralExclusive(
	a: ReadonlySet<string>,
	b: ReadonlySet<string>,
): number {
	const bParents = new Set<string>();
	for (const token of b) {
		bParents.add(parentPath(token));
	}
	let count = 0;
	for (const token of a) {
		if (!b.has(token) && !bParents.has(parentPath(token))) count++;
	}
	return count;
}

/**
 * Drops every proposed `[absorbed, root]` merge that would undo a separation
 * Stage A made on real evidence. A merge is dropped when all of these hold:
 *
 * 1. Stage A separated the two groups ({@link areStageASeparated}).
 * 2. Each core has at least {@link MIN_EXCLUSIVE_TOKENS} tokens the other
 *    lacks — neither is a conditional render of the other.
 * 3. The pair is not a class-name-only difference: a pair whose raw cores
 *    are below `threshold` but whose class-stripped cores reach
 *    `shapeThreshold` is the same skeleton under different BEM names, which
 *    Stage A (comparing raw tokens) cannot have judged.
 *
 * (3) keys on raw similarity, not on which merge path proposed the pair: a
 * list page and a detail page with a shared wrapper are also similar after
 * class stripping, but their raw cores are already above `threshold`, so
 * they are still dropped.
 *
 * Runs before {@link ./merge-cross-block-clusters.js | filterMergesByCohesion}
 * and applies to both the fine and the L2 stage: when every fine proposal is
 * dropped the same round falls through to L2, whose shell corroboration is
 * trivially satisfied inside one block. Pairs without lineage (units that
 * name no block) are never dropped.
 *
 * Several groups proposed for the same root are checked against the root
 * and against every group already accepted into it in this call. The
 * proposals come from a transitive union-find, so `c` can be joined to root
 * `a` only because both are close to `b`; comparing `c` with `a` alone would
 * let it join a group whose member `b` Stage A had kept it apart from.
 * @param proposedMerges `[absorbedKey, rootKey]` pairs from a stage's union-find pass.
 * @param context
 * @example
 * ```ts
 * // `news` list (31 pages) and detail (165 pages) share a wrapper, each with 3 own tokens.
 * filterMergesByStageASeparation([['detail', 'list']], context); // []
 * ```
 */
export function filterMergesByStageASeparation(
	proposedMerges: readonly [string, string][],
	context: StageASeparationContext,
): [string, string][] {
	const empty: ReadonlySet<string> = new Set();

	const isVetoed = (absorbed: string, member: string): boolean => {
		const absorbedLineage = context.lineageByRoot.get(absorbed) ?? [];
		const memberLineage = context.lineageByRoot.get(member) ?? [];
		if (!areStageASeparated(absorbedLineage, memberLineage)) {
			return false;
		}

		const absorbedCore = context.cores.get(absorbed) ?? empty;
		const memberCore = context.cores.get(member) ?? empty;
		if (
			countStructuralExclusive(absorbedCore, memberCore) < MIN_EXCLUSIVE_TOKENS ||
			countStructuralExclusive(memberCore, absorbedCore) < MIN_EXCLUSIVE_TOKENS
		) {
			return false;
		}

		const rawSimilarity = jaccardSimilarity(absorbedCore, memberCore);
		const shapedSimilarity = jaccardSimilarity(
			context.shapedCores.get(absorbed) ?? empty,
			context.shapedCores.get(member) ?? empty,
		);
		const classNameOnly =
			rawSimilarity < context.threshold && shapedSimilarity >= context.shapeThreshold;
		return !classNameOnly;
	};

	const acceptedByRoot = new Map<string, string[]>();
	return proposedMerges.filter(([absorbed, root]) => {
		const accepted = acceptedByRoot.get(root) ?? [];
		if ([root, ...accepted].some((member) => isVetoed(absorbed, member))) {
			return false;
		}
		acceptedByRoot.set(root, [...accepted, absorbed]);
		return true;
	});
}
