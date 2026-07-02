import type { Frame, ResolvedOptions } from './types.js';

import { buildSegment } from './build-segment.js';
import { isFoldCandidate } from './is-fold-candidate.js';
import { parseClassList } from './parse-class-list.js';

/**
 * Builds the stack frame for a newly-opened element. `id`/`data-*`/every
 * `aria-*` other than `role` are read from `attribs` implicitly by never
 * being looked at: `id`/`data-*` tend to be per-instance/per-page values
 * (breaking similarity detection the same way raw text would), and
 * non-`role` `aria-*` attributes are either free-text (`aria-label`,
 * `aria-describedby` — inconsistent with dropping visible text) or render
 * state (`aria-current`, `aria-expanded`, `aria-selected` — the same
 * per-page-varying-position problem as a `current`/`active` class, see
 * `tokenize.ts`).
 * @param tagName
 * @param attribs
 * @param options
 */
export function createFrame(
	tagName: string,
	attribs: Record<string, string>,
	options: ResolvedOptions,
): Frame {
	const classList = parseClassList(attribs.class, options.filterNoiseClasses);
	const role = attribs.role || undefined;
	const type = attribs.type || undefined;

	return {
		tagName,
		segment: buildSegment(tagName, classList, role, type),
		isFoldCandidate: isFoldCandidate(tagName, classList, role, type),
		childElementCount: 0,
		pendingPaths: [],
	};
}
