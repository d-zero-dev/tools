/**
 * Escapes regex metacharacters in `text` so it can be interpolated into a
 * `RegExp` literally. Needed because a tag name reaching
 * {@link ./is-genuine-close.js | isGenuineClose} is not guaranteed to be a
 * plain HTML tag name: htmlparser2 accepts characters like `(`/`[` inside a
 * tag name (`<div(foo role="banner">` parses with tag name `"div(foo"`),
 * which would otherwise either throw (an unbalanced `(` is an invalid regex)
 * or silently change what the regex matches.
 * @param text
 */
export function escapeRegExp(text: string): string {
	return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
