import type { DetectionResult, RawLayoutNode } from './types.js';

import { parseDisplay } from './parse-display.js';

/**
 * Internal display values that participate in a CSS table (as opposed to
 * ruby's internal values, which don't). Listed explicitly rather than
 * matched by prefix so this stays a closed, reviewable set instead of a
 * string-shape guess.
 */
const TABLE_INTERNAL_DISPLAY_VALUES: ReadonlySet<string> = new Set([
	'table-row-group',
	'table-header-group',
	'table-footer-group',
	'table-row',
	'table-cell',
	'table-column-group',
	'table-column',
	'table-caption',
]);

/**
 * Detects whether a container itself is a table — either the `<table>`
 * element or a CSS table display (`display: table`/`inline-table`, or one
 * of the table-internal display values). Checked first, ahead of all
 * geometric detectors, because a `<table>`'s row/column structure is
 * authoritative regardless of what its cell geometry looks like.
 * @param node
 * @example
 * ```ts
 * detectTablePattern({ tagName: 'TABLE', style: { display: 'table', ... }, ... });
 * // { matched: true, confidence: 1, signals: { ... } }
 * ```
 */
export function detectTablePattern(node: RawLayoutNode): DetectionResult {
	const parsed = parseDisplay(node.style.display);
	const isTableTag = node.tagName === 'TABLE';
	const isTableDisplay = parsed.kind === 'box-generating' && parsed.inside === 'table';
	const isTableInternal =
		parsed.kind === 'internal' && TABLE_INTERNAL_DISPLAY_VALUES.has(parsed.value);

	const matched = isTableTag || isTableDisplay || isTableInternal;

	return {
		matched,
		confidence: matched ? (isTableTag ? 1 : 0.9) : 0,
		signals: {
			tagName: node.tagName,
			display: node.style.display,
			parsedDisplay: parsed,
		},
	};
}
