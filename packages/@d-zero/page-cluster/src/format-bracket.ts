/**
 * Formats a `[key=value,...]` suffix from named attributes, omitting
 * `undefined` entries and sorting the `key=value` pairs alphabetically for a
 * deterministic order. Shared by `build-segment.ts` (role/type on ordinary
 * elements) and `run-tokenizer.ts` (role/type/sha on opaque
 * `script`/`style`/`svg`/`noscript` elements), since an opaque element like
 * `<svg role="img">` still carries a meaningful `role` alongside its content
 * hash.
 * @param attrs
 */
export function formatBracket(attrs: Record<string, string | undefined>): string {
	const entries = Object.entries(attrs)
		.filter((entry): entry is [string, string] => entry[1] !== undefined)
		.map(([key, value]) => `${key}=${value}`)
		.toSorted();

	return entries.length > 0 ? `[${entries.join(',')}]` : '';
}
