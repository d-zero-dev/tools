/**
 * A 1-based line/column position within an HTML string.
 */
export type LineColumn = { readonly line: number; readonly column: number };

/**
 * Precomputed lookup structure for {@link ./offset-to-line-column.js | offsetToLineColumn}:
 * every newline's string-index offset, ascending.
 */
export type LineColumnIndex = { readonly newlineOffsets: readonly number[] };

/**
 * Scans `html` once and records every `\n` offset, so repeated
 * {@link ./offset-to-line-column.js | offsetToLineColumn} calls against the
 * same HTML string can binary-search instead of re-scanning from the start
 * each time. Built once per page and reused across every landmark instance's
 * start/end offset — a page with dozens of landmark instances would
 * otherwise pay for a fresh O(n) scan per offset instead of one O(n) scan
 * total.
 * @param html
 */
export function buildLineColumnIndex(html: string): LineColumnIndex {
	const newlineOffsets: number[] = [];
	for (let i = 0; i < html.length; i++) {
		if (html.codePointAt(i) === 10) newlineOffsets.push(i);
	}
	return { newlineOffsets };
}

/**
 * Converts a string-index `offset` (the same unit as `htmlparser2`'s
 * `startIndex`/`endIndex`, i.e. UTF-16 code units) into a 1-based
 * `{line, column}` position, using an index built by
 * {@link ./offset-to-line-column.js | buildLineColumnIndex}.
 *
 * `\r\n` line endings are handled without special-casing: the `\r` is
 * counted as the last column of its own line, matching how most editors
 * report position for CRLF files.
 * @param index
 * @param offset
 */
export function offsetToLineColumn(index: LineColumnIndex, offset: number): LineColumn {
	const { newlineOffsets } = index;

	let low = 0;
	let high = newlineOffsets.length;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (newlineOffsets[mid]! < offset) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}
	// `low` is the count of newlines strictly before `offset`, i.e. the
	// number of completed lines — so `low` newlines completed means we're on
	// line `low + 1`.
	const lineStart = low === 0 ? 0 : newlineOffsets[low - 1]! + 1;
	return { line: low + 1, column: offset - lineStart + 1 };
}
