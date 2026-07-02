import { FOLDABLE_TAGS } from './foldable-tags.js';
import { formatBracket } from './format-bracket.js';

/**
 * Builds the path segment string for one element.
 *
 * `div`/`span` drop their tag name in favor of `.class` when they carry a
 * class list, since the class (not the generic wrapper tag) is what carries
 * meaning for those two tags. Every other tag always keeps its name because
 * the tag itself is semantically meaningful (e.g. `ul`, `table`, `button`).
 *
 * `role`/`type` are appended as a bracket suffix rather than folded into the
 * class list: unlike `class`, they are single-valued attributes with their
 * own semantics (ARIA role, form control kind), so keeping them visually
 * distinct avoids collisions with an actual class named e.g. `button`.
 * @param tagName
 * @param classList
 * @param role
 * @param type
 */
export function buildSegment(
	tagName: string,
	classList: readonly string[],
	role?: string,
	type?: string,
): string {
	const base =
		classList.length > 0
			? FOLDABLE_TAGS.has(tagName)
				? `.${classList.join('.')}`
				: `${tagName}.${classList.join('.')}`
			: tagName;

	return `${base}${formatBracket({ role, type })}`;
}
