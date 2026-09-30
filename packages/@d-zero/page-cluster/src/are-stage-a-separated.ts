import type { StageALineageEntry } from './stage-a-lineage.js';

/**
 * How many pages each of two Stage-A clusters must hold for Stage A's
 * decision to keep them apart to count as evidence they are different
 * templates. Below this, "Stage A left them in separate clusters" only means
 * "each is a leftover with content unlike the rest" — a single page of a
 * freeform template is always its own cluster, and treating that as a
 * verdict would forbid exactly the merges Stage B exists for (dozens of
 * one-page units of the same template that only differ in their freeform
 * body). With several pages per side the block's quorum makes each side's
 * shared structure stable, so the split reflects structure and not page noise.
 */
export const STAGE_A_SEPARATION_MIN_PAGES = 3;

/**
 * Whether Stage A already told the two groups apart with real evidence: some
 * unit pooled into `a` and some unit pooled into `b` came from the same
 * Pass-0 block, were compared there on block-local comparison sets, ended
 * up as different clusters, and each held at least
 * {@link STAGE_A_SEPARATION_MIN_PAGES} pages.
 *
 * Why the block-local verdict is worth keeping: Stage B compares cores whose
 * "distinctive" tokens are derived against the whole corpus, so structure
 * that is common to one block (a list page's and a detail page's shared
 * wrapper) but rare corpus-wide stays in both cores and dominates their
 * overlap. Stage A judged the same pair against the block's own frequencies
 * and separated it.
 *
 * Why not derive the shell from a pair-local or block-local frequency split
 * inside Stage B instead: pair-local, every token shared by two singletons
 * is "present in all pages", so all of it — template included — would count
 * as shell, and an imbalanced pair (6 pages against 63) classes the big
 * side's stable tokens as shell too; block-local, a homogeneous block's own
 * template tokens are shell, which reproduces Stage A's over-splitting that
 * Stage B exists to undo.
 * @param a
 * @param b
 * @example
 * ```ts
 * areStageASeparated(
 * 	[{ blockKey: 'path:news', pageCount: 31 }],
 * 	[{ blockKey: 'path:news', pageCount: 165 }],
 * ); // true
 * areStageASeparated(
 * 	[{ blockKey: 'path:news', pageCount: 1 }],
 * 	[{ blockKey: 'path:news', pageCount: 1 }],
 * ); // false — single pages carry no evidence
 * areStageASeparated(
 * 	[{ blockKey: 'path:news', pageCount: 31 }],
 * 	[{ blockKey: 'path:about', pageCount: 165 }],
 * ); // false — never compared by Stage A
 * ```
 */
export function areStageASeparated(
	a: readonly StageALineageEntry[],
	b: readonly StageALineageEntry[],
): boolean {
	return a.some(
		(left) =>
			left.pageCount >= STAGE_A_SEPARATION_MIN_PAGES &&
			b.some(
				(right) =>
					right.blockKey === left.blockKey &&
					right.pageCount >= STAGE_A_SEPARATION_MIN_PAGES,
			),
	);
}
