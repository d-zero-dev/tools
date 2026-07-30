/**
 * Structured parser for computed `display` values.
 *
 * WHY not string matching: CSS Display Module Level 3 allows a two-value
 * syntax (`<display-outside> <display-inside>`, e.g. `block flex`,
 * `inline grid`) alongside the legacy single-keyword forms (`flex`,
 * `inline-grid`). A substring check like `display.includes('grid')` would
 * misparse `inline-grid-column` style false positives were such a value
 * ever introduced, and can't distinguish `table` the box type from
 * `table-cell` the internal display value. This module tokenizes on
 * whitespace and matches whole tokens against known keyword sets instead.
 * @module
 */

export type DisplayOutside = 'block' | 'inline' | 'run-in';
export type DisplayInside = 'flow' | 'flow-root' | 'table' | 'flex' | 'grid' | 'ruby';

export type ParsedDisplay =
	| {
			kind: 'box-generating';
			outside: DisplayOutside;
			inside: DisplayInside;
			/** `true` when the `list-item` keyword is present alongside the outer/inner pair. */
			listItem: boolean;
	  }
	| {
			/** Table/ruby internal parts (`table-cell`, `table-row`, `ruby-base`, ...) that don't generate an independent principal box. */
			kind: 'internal';
			value: string;
	  }
	| { kind: 'none' }
	| { kind: 'contents' };

/** Legacy single-keyword forms, normalized to their two-value equivalent. */
const LEGACY_DISPLAY_MAP: Readonly<
	Record<string, { outside: DisplayOutside; inside: DisplayInside }>
> = {
	block: { outside: 'block', inside: 'flow' },
	inline: { outside: 'inline', inside: 'flow' },
	'run-in': { outside: 'run-in', inside: 'flow' },
	'inline-block': { outside: 'inline', inside: 'flow-root' },
	'flow-root': { outside: 'block', inside: 'flow-root' },
	flex: { outside: 'block', inside: 'flex' },
	'inline-flex': { outside: 'inline', inside: 'flex' },
	grid: { outside: 'block', inside: 'grid' },
	'inline-grid': { outside: 'inline', inside: 'grid' },
	table: { outside: 'block', inside: 'table' },
	'inline-table': { outside: 'inline', inside: 'table' },
};

const OUTSIDE_VALUES: ReadonlySet<string> = new Set(['block', 'inline', 'run-in']);
const INSIDE_VALUES: ReadonlySet<string> = new Set([
	'flow',
	'flow-root',
	'table',
	'flex',
	'grid',
	'ruby',
]);
const INTERNAL_VALUES: ReadonlySet<string> = new Set([
	'table-row-group',
	'table-header-group',
	'table-footer-group',
	'table-row',
	'table-cell',
	'table-column-group',
	'table-column',
	'table-caption',
	'ruby-base',
	'ruby-text',
	'ruby-base-container',
	'ruby-text-container',
]);

/**
 * Parses a computed `display` string into its outer/inner display parts.
 * Accepts both legacy single-keyword values and the two-value syntax, in
 * any token order. Unrecognized tokens are ignored rather than treated as
 * a parse failure, since `getComputedStyle` values are never attacker- or
 * author-controlled strings we need to reject — only interpret.
 * @param rawDisplay - The verbatim `getComputedStyle(...).display` value.
 * @example
 * ```ts
 * parseDisplay('flex'); // { kind: 'box-generating', outside: 'block', inside: 'flex', listItem: false }
 * parseDisplay('inline grid'); // { kind: 'box-generating', outside: 'inline', inside: 'grid', listItem: false }
 * parseDisplay('table-cell'); // { kind: 'internal', value: 'table-cell' }
 * ```
 */
export function parseDisplay(rawDisplay: string): ParsedDisplay {
	const tokens = rawDisplay.trim().split(/\s+/u).filter(Boolean);

	if (tokens.length === 0 || tokens.includes('none')) {
		return { kind: 'none' };
	}
	if (tokens.includes('contents')) {
		return { kind: 'contents' };
	}

	if (tokens.length === 1) {
		const token = tokens[0]!;
		if (INTERNAL_VALUES.has(token)) {
			return { kind: 'internal', value: token };
		}
		if (token === 'list-item') {
			return { kind: 'box-generating', outside: 'block', inside: 'flow', listItem: true };
		}
		const legacy = LEGACY_DISPLAY_MAP[token];
		if (legacy) {
			return { kind: 'box-generating', ...legacy, listItem: false };
		}
		// Unrecognized single keyword (e.g. a future CSS value): fall back to
		// the most conservative box-generating interpretation rather than
		// throwing, so an unfamiliar value degrades to "ordinary block" instead
		// of crashing the whole capture.
		return { kind: 'box-generating', outside: 'block', inside: 'flow', listItem: false };
	}

	// Two-value syntax (in either token order) plus an optional `list-item`.
	let outside: DisplayOutside | undefined;
	let inside: DisplayInside | undefined;
	let listItem = false;
	for (const token of tokens) {
		if (outside === undefined && OUTSIDE_VALUES.has(token)) {
			outside = token as DisplayOutside;
		} else if (inside === undefined && INSIDE_VALUES.has(token)) {
			inside = token as DisplayInside;
		} else if (token === 'list-item') {
			listItem = true;
		}
	}
	return {
		kind: 'box-generating',
		outside: outside ?? 'block',
		inside: inside ?? 'flow',
		listItem,
	};
}
