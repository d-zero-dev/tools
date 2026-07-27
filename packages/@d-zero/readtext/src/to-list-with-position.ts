import type { ListItem } from './types.js';

/**
 * Splits text into non-empty, non-comment lines (same rules as `toList`),
 * keeping each surviving line's 1-origin line/column position in the
 * original text.
 *
 * `toList` discards this position by filtering before returning a plain
 * `string[]` — a caller that needs to report "line 3 of the source file was
 * invalid" back to a user cannot reconstruct it from the filtered array
 * alone, since blank lines and `#` comments have already shifted the index.
 * @param text - The raw text to split into lines.
 * @returns Surviving lines with their original line/column position.
 * @example
 * ```typescript
 * const items = toListWithPosition('item1\n# comment\n\n  item2\n');
 * // items: [
 * //   { value: 'item1', line: 1, column: 1 },
 * //   { value: 'item2', line: 4, column: 3 },
 * // ]
 * ```
 */
export function toListWithPosition(text: string): ListItem[] {
	const lines = text.split('\n');
	const items: ListItem[] = [];

	for (const [index, rawLine] of lines.entries()) {
		const value = rawLine.trim();

		// Empty (post-trim) and comment lines are dropped, matching `toList`.
		if (value.length === 0 || value.startsWith('#')) {
			continue;
		}

		const leadingWhitespaceLength = rawLine.length - rawLine.trimStart().length;
		items.push({
			value,
			line: index + 1,
			column: leadingWhitespaceLength + 1,
		});
	}

	return items;
}
