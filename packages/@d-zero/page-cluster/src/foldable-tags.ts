/**
 * Tags eligible to have their tag name replaced by `.class` in
 * `build-segment.ts` and to be elided entirely from the path when they have
 * exactly one element child in `is-fold-candidate.ts`. Kept as a single
 * source of truth so the two modules can't silently disagree on which tags
 * are "generic wrappers".
 */
export const FOLDABLE_TAGS = new Set(['div', 'span']);
