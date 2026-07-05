import { escapeRegExp } from './escape-reg-exp.js';

/**
 * Whether `html` actually contains a literal closing tag for `tagName`
 * ending at `endOffset`. htmlparser2 fires `onclosetag` not only for real
 * closing tags but also when it force-closes a still-open ancestor to
 * resolve a mismatch (e.g. `<header>H<main>...</main></body>` with no
 * `</header>` ever written) — and in that forced case it reports the
 * force-closed element's `endIndex` as wherever the *other*, unrelated
 * closing tag that triggered the cascade happens to sit, not any position
 * derived from the matched element itself (confirmed by direct htmlparser2
 * event tracing: both the synthetic close and the real `body` close report
 * the identical `endIndex`, because there is no real closing tag in the
 * source for htmlparser2 to anchor a distinct position to). Trusting that
 * offset would slice a candidate spanning all the way to wherever the
 * unrelated tag ends, silently swallowing real content into the caller's
 * remainder HTML. Checking that the text immediately preceding `endOffset`
 * actually spells the expected closing tag catches exactly this: a genuine
 * close always ends with it; a forced one ends with whatever unrelated tag
 * forced it instead.
 * @param html
 * @param endOffset
 * @param tagName
 */
export function isGenuineClose(
	html: string,
	endOffset: number,
	tagName: string,
): boolean {
	const windowStart = Math.max(0, endOffset - tagName.length - 3);
	return new RegExp(`</\\s*${escapeRegExp(tagName)}\\s*>$`, 'i').test(
		html.slice(windowStart, endOffset),
	);
}
