import { FOLDABLE_TAGS } from './foldable-tags.js';

/**
 * Whether this element is eligible to be elided from the path when it turns
 * out to have exactly one element child (see `resolve-closed-frame.ts`).
 *
 * Only class-less, role-less, type-less `div`/`span` qualify: a `class`,
 * `role`, or `type` means the element carries structural or semantic
 * information that would be lost if the element disappeared from the path.
 * @param tagName
 * @param classList
 * @param role
 * @param type
 */
export function isFoldCandidate(
	tagName: string,
	classList: readonly string[],
	role?: string,
	type?: string,
): boolean {
	return FOLDABLE_TAGS.has(tagName) && classList.length === 0 && !role && !type;
}
