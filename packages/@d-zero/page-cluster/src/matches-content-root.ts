import type { ContentRoot } from './types.js';

/**
 * Whether one element (as seen by the HTML walk in
 * {@link ./find-shallowest-elements.js | findMatchingElements}) is the
 * content root `root` describes.
 *
 * Every given field must match: `tagName` compares case-insensitively,
 * `id` and `role` compare exactly, and `classList` is a subset test against
 * the element's whitespace-split `class` attribute. Empty strings and empty
 * arrays are treated as absent. A root with no constraint left matches
 * nothing, and `<body>` never matches — a CMS commonly puts an `id` or
 * classes on `<body>`, and capping "inside `<body>`" would be the same as
 * capping the whole page.
 * @param root
 * @param tagName
 * @param attribs
 * @example
 * ```ts
 * const root = { tagName: 'DIV', id: 'main', classList: ['spc'] };
 * matchesContentRoot(root, 'div', { id: 'main', class: 'spc wide' }); // true
 * matchesContentRoot(root, 'div', { id: 'main' }); // false — 'spc' is missing
 * matchesContentRoot({}, 'div', { id: 'main' }); // false — no constraint
 * ```
 */
export function matchesContentRoot(
	root: ContentRoot,
	tagName: string,
	attribs: Readonly<Record<string, string>>,
): boolean {
	if (tagName === 'body') {
		return false;
	}

	const wantedTag = root.tagName ? root.tagName.toLowerCase() : undefined;
	const wantedId = root.id || undefined;
	const wantedRole = root.role || undefined;
	const wantedClasses = root.classList?.filter(Boolean) ?? [];

	if (
		wantedTag === undefined &&
		wantedId === undefined &&
		wantedRole === undefined &&
		wantedClasses.length === 0
	) {
		return false;
	}

	if (wantedTag !== undefined && wantedTag !== tagName) {
		return false;
	}
	if (wantedId !== undefined && attribs.id !== wantedId) {
		return false;
	}
	if (wantedRole !== undefined && attribs.role !== wantedRole) {
		return false;
	}
	if (wantedClasses.length > 0) {
		const present = new Set((attribs.class ?? '').split(/\s+/).filter(Boolean));
		if (!wantedClasses.every((className) => present.has(className))) {
			return false;
		}
	}
	return true;
}
