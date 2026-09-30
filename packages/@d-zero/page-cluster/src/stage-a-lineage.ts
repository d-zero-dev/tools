/**
 * One Stage-A cluster that has been pooled into a Stage-B group: the Pass-0
 * block it came from and how many pages it held. A Stage-B group carries the
 * entries of every original unit merged into it, so a later merge proposal
 * can ask "did Stage A already tell the two sides apart?" — see
 * {@link ./are-stage-a-separated.js | areStageASeparated}.
 */
export type StageALineageEntry = {
	readonly blockKey: string;
	readonly pageCount: number;
};

/**
 * The lineage of a not-yet-merged unit: one entry for the unit itself, or
 * none when the unit does not say which block it came from (a hand-built
 * unit, or any caller that does not run Stage A). An empty lineage is
 * "no evidence", which every consumer treats as "do not veto".
 * @param unit
 * @param unit.blockKey
 * @param unit.memberTokenSets
 * @example
 * ```ts
 * initialLineage({ blockKey: 'path:news', memberTokenSets: [new Set(), new Set()] });
 * // [{ blockKey: 'path:news', pageCount: 2 }]
 * initialLineage({ memberTokenSets: [new Set()] });
 * // []
 * ```
 */
export function initialLineage(unit: {
	readonly blockKey?: string;
	readonly memberTokenSets: readonly unknown[];
}): StageALineageEntry[] {
	return unit.blockKey === undefined
		? []
		: [{ blockKey: unit.blockKey, pageCount: unit.memberTokenSets.length }];
}
