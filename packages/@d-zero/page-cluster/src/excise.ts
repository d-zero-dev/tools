import { mergeSpans } from './merge-spans.js';

/**
 * Excises `spans` (merged via {@link ./merge-spans.js | mergeSpans}) from
 * `html`, returning what's left. No placeholder is left in a span's place: a
 * placeholder string would itself become a token once the remainder is
 * tokenized, reintroducing exactly the kind of synthetic signal callers of
 * this function exist to remove.
 * @param html
 * @param spans
 */
export function excise(
	html: string,
	spans: readonly { start: number; end: number }[],
): string {
	if (spans.length === 0) {
		return html;
	}
	const merged = mergeSpans(spans);
	let remainder = '';
	let cursor = 0;
	for (const span of merged) {
		remainder += html.slice(cursor, span.start);
		cursor = span.end;
	}
	remainder += html.slice(cursor);
	return remainder;
}
