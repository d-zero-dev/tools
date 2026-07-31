/**
 * Main-content geometry capture for a rendered page.
 *
 * Runs entirely against a `Document` (Puppeteer page realm or jsdom with a
 * `getBoundingClientRect` shim — see the spec) so the tree-shape logic is
 * unit-tested without a browser, matching the pattern in
 * `@d-zero/beholder/get-main-contents.ts`.
 *
 * This function makes no layout judgment: it only resolves the main-content
 * element and walks its descendants into a `RawLayoutNode` tree of
 * geometry + raw style + innerHTML. Classification happens later, in
 * `classify-layout-tree.ts`, against this tree — never here.
 *
 * WHY every helper is nested inside `captureLayoutTree` rather than a
 * sibling top-level function (unlike this file's other exports): Puppeteer
 * serializes a `page.evaluate` callback via `Function#toString()` and
 * re-evaluates only that source text inside the browser realm — it does
 * not ship any other declaration from this module along with it. A sibling
 * top-level helper would be `undefined` at runtime in the page, throwing
 * `ReferenceError` on first use. `extractMainContentsFromDocument` in
 * `@d-zero/beholder` nests its helpers for the same reason; this function
 * does too, for the same reason no `@medv/finder` / shared-helper import is // cspell:disable-line
 * usable here either. The selector arrays are instead passed as plain-data
 * arguments (see `capture-layout.ts`), sourced from
 * `@d-zero/beholder`'s `MAIN_CONTENT_SELECTORS` / `MAIN_CONTENT_FALLBACK_SELECTORS`
 * rather than re-resolving `extractMainContentsFromDocument`'s own
 * diagnostic-only selector string. That string is a tag+id+class
 * fingerprint built for logging, not a unique identity — re-querying it
 * (e.g. a bare `<div>` with no id/class resolving to the selector `"div"`)
 * can match a different element than the one actually found, so this
 * module resolves the element itself directly instead of round-tripping
 * through that string.
 *
 * WHY the priority-list resolution logic in `resolveMainElement` is
 * duplicated rather than shared: same closure-free constraint as above.
 * `extractMainContentsFromDocument` (`@d-zero/beholder/get-main-contents.ts`)
 * independently re-implements the identical "try each selector in array
 * order, first match wins" strategy for the same reason. The two copies
 * have drifted out of sync before (one queried the array with a single
 * `querySelector(selectors.join(','))` — which resolves by DOM document
 * order, not array priority — while the other still tried selectors one at
 * a time); `capture-layout-tree.spec.ts` and `get-main-contents.spec.ts`
 * both carry matching regression cases (searchable by the test name
 * "prefers a higher-priority selector...") specifically so that fixing one
 * side's resolution logic without the other shows up as a spec gap, not a
 * silent divergence.
 * @module
 */

import type { RawLayoutNode } from './types.js';

/**
 * Resolves the main-content element and captures its subtree geometry.
 * @param mainContentSelector - Explicit selector that, when given, is used
 *   on its own — no fallback to the priority list on a miss. Unlike
 *   `extractMainContentsFromDocument`'s OR-selector approach, this fully
 *   replaces the priority-list/fallback search: joining it into one
 *   combined selector would let DOM order override the caller's explicit
 *   choice (`#custom,main` still matches whichever of the two appears
 *   first in the document, not `#custom` specifically), and a caller
 *   passing `--main-selector` wants exactly that element or nothing.
 * @param selectors - Priority-ordered selector list
 *   (`@d-zero/beholder`'s `MAIN_CONTENT_SELECTORS`), passed as data because
 *   this function must stay closure-free for `page.evaluate`.
 * @param fallbackSelectors - Loose fallback selectors
 *   (`@d-zero/beholder`'s `MAIN_CONTENT_FALLBACK_SELECTORS`).
 * @param captureMaxDepth - Hard recursion cap on how far the walk descends.
 *   Deliberately generous (see `capture-layout.ts`'s default) and is not
 *   the same knob as `should-recurse.ts`'s `maxDepth`: the classify layer
 *   decides where the *meaningful* layout tree ends (collapsing
 *   single-child wrappers first), so capture must go deeper than that to
 *   avoid truncating data classification would otherwise use.
 * @param doc - The document to inspect (defaults to the global `document`
 *   in the page realm; jsdom tests pass an explicit `Document`).
 * @returns The resolved main selector (`null` when nothing matched) and
 *   its captured subtree (`null` alongside it in that case).
 * @example
 * ```ts
 * // In page.evaluate / browser:
 * const { root } = captureLayoutTree(null, MAIN_CONTENT_SELECTORS, MAIN_CONTENT_FALLBACK_SELECTORS, 30);
 * ```
 */
export function captureLayoutTree(
	mainContentSelector: string | null,
	selectors: readonly string[],
	fallbackSelectors: readonly string[],
	captureMaxDepth: number,
	doc: Document = document,
): { mainSelector: string | null; root: RawLayoutNode | null } {
	const win = doc.defaultView;
	if (!win) {
		return { mainSelector: null, root: null };
	}

	/**
	 * @param value
	 */
	function cssEscape(value: string): string {
		if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
			return CSS.escape(value);
		}
		return value.replaceAll(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
	}

	/**
	 * Builds a tag+id+class diagnostic selector for the resolved main
	 * element, so callers can pass it back via `--main-selector` on a later
	 * run to skip re-resolution. Not guaranteed unique (same caveat as
	 * beholder's `buildSelector`) — it's a diagnostic/reuse aid, not an identity.
	 * @param el
	 */
	function buildDiagnosticSelector(el: Element): string {
		const tag = el.nodeName.toLowerCase();
		const id = el.id ? `#${cssEscape(el.id)}` : '';
		const classes = [...el.classList].map((c) => `.${cssEscape(c)}`).join('');
		return `${tag}${id}${classes}`;
	}

	/**
	 * Resolves the main-content element using the same priority-list-then-
	 * fallback strategy as `extractMainContentsFromDocument`, but returns
	 * the `Element` itself (needed to walk its subtree) rather than a
	 * metrics summary.
	 */
	function resolveMainElement(): Element | null {
		if (mainContentSelector) {
			try {
				return doc.querySelector(mainContentSelector);
			} catch {
				return null;
			}
		}

		// Tried one at a time, in priority order, rather than joined into a
		// single `querySelector(selectors.join(','))` call: a CSS group
		// selector matches whichever selector is first in *document order*,
		// not whichever is first in this array — an ancestor wrapper matching
		// a low-priority selector (e.g. `#contents`) would win over a
		// descendant matching a higher-priority one (e.g. `#main`) just
		// because it appears earlier in the DOM. Querying one selector at a
		// time makes this array's order the actual priority.
		let element: Element | null = null;
		for (const sel of selectors) {
			try {
				element = doc.querySelector(sel);
			} catch {
				// The built-in selector list is a fixed, known-valid constant,
				// so this should be unreachable — but fail closed rather than
				// aborting the whole priority list over one bad entry.
				continue;
			}
			if (element) {
				break;
			}
		}

		if (element) {
			return element;
		}

		for (const sel of fallbackSelectors) {
			const candidate = doc.querySelector(sel);
			if (candidate && candidate !== doc.body && candidate !== doc.documentElement) {
				return candidate;
			}
		}

		return null;
	}

	/**
	 * Recursively captures one element and its descendants.
	 *
	 * Elements with no rendered box (`display: none`, zero-area) still
	 * appear as a node (so their existence and raw style are visible in the
	 * output) but their descendants are not walked — there is nothing a
	 * hidden subtree's geometry could contribute to layout classification.
	 *
	 * Frame and shadow boundaries are not crossed: an `<iframe>` is captured
	 * as a childless node (its content is a different document), and
	 * shadow-root children are not visited (`el.children` only ever sees
	 * light-DOM children).
	 * @param el
	 * @param originRect
	 * @param remainingDepth
	 * @param view - Threaded through explicitly (rather than closing over
	 *   the outer `win`) because TypeScript can't carry the outer
	 *   null-check's narrowing into a nested function declaration.
	 */
	function captureNode(
		el: Element,
		originRect: DOMRect,
		remainingDepth: number,
		view: Window,
	): RawLayoutNode {
		const rect = el.getBoundingClientRect();
		const computed = view.getComputedStyle(el);
		const style = {
			display: computed.display,
			float: computed.float,
			position: computed.position,
			visibility: computed.visibility,
		};
		const isRendered = style.display !== 'none' && rect.width > 0 && rect.height > 0;
		const isFrame = el.tagName === 'IFRAME';

		const children: RawLayoutNode[] =
			isRendered && !isFrame && remainingDepth > 0
				? [...el.children].map((child) =>
						captureNode(child, rect, remainingDepth - 1, view),
					)
				: [];

		return {
			tagName: el.tagName,
			id: el.id || null,
			classList: [...el.classList],
			boundingBox: {
				x: rect.x - originRect.x,
				y: rect.y - originRect.y,
				width: rect.width,
				height: rect.height,
			},
			style,
			innerHTML: el.innerHTML,
			children,
		};
	}

	const mainElement = resolveMainElement();
	if (!mainElement) {
		return { mainSelector: null, root: null };
	}

	const originRect = mainElement.getBoundingClientRect();
	return {
		mainSelector: buildDiagnosticSelector(mainElement),
		root: captureNode(mainElement, originRect, captureMaxDepth, win),
	};
}
