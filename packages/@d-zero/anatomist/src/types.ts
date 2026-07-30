/**
 * Shared types for the capture → classify pipeline.
 *
 * `RawLayoutNode` is what the browser realm produces (geometry + raw CSS,
 * no judgment). `LayoutBlock` is what the classify layer produces (a
 * judgment attached to that geometry). Keeping them as separate types
 * — rather than one type with optional classification fields — makes it
 * a compile error to read a classification off data that hasn't been
 * classified yet.
 * @module
 */

/** Axis-aligned box, in coordinates relative to the parent node's own box (not the viewport). */
export type BoundingBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * The subset of `getComputedStyle` read for one element, captured verbatim
 * (before any interpretation). `display` is the raw computed string —
 * see `parse-display.ts` for why it isn't pre-parsed here.
 */
export type RawNodeStyle = {
	display: string;
	float: string;
	position: string;
	visibility: string;
};

/**
 * One element captured from the live DOM: geometry + raw style + children,
 * with no layout judgment attached. Produced by `capture-layout-tree.ts`
 * inside `page.evaluate`.
 */
export type RawLayoutNode = {
	tagName: string;
	id: string | null;
	classList: readonly string[];
	boundingBox: BoundingBox;
	style: RawNodeStyle;
	innerHTML: string;
	children: readonly RawLayoutNode[];
};

/**
 * Visual layout pattern assigned to a block. Names describe what the
 * geometry looks like, not the CSS mechanism that produced it — a
 * `horizontal-row` may be `display: flex`, `grid`, or `inline-block`
 * under the hood; the mechanism is recorded in `signals` instead, so both
 * the visual read and the implementation detail stay inspectable.
 */
export type LayoutType =
	| 'vertical-stack'
	| 'horizontal-row'
	| 'simple-grid'
	| 'complex-grid'
	| 'table'
	| 'float-wrap'
	| 'unknown'
	/** No layout judgment was made because this block has no children to arrange (see `should-recurse.ts`) — `confidence` is always `0` and `children` is always empty. Distinct from `unknown`, which means children exist but no detector matched. */
	| 'leaf';

/**
 * One classified block in the recursive layout tree. `boundingBox` and
 * `innerHTML` are carried over verbatim from the matching `RawLayoutNode`;
 * `layoutType`/`confidence`/`signals` are the classify layer's judgment.
 */
export type LayoutBlock = {
	layoutType: LayoutType;
	tagName: string;
	id: string | null;
	classList: readonly string[];
	boundingBox: BoundingBox;
	innerHTML: string;
	/** 0–1. Not a probability — a relative measure of how cleanly the geometry matched `layoutType`'s pattern. */
	confidence: number;
	/** Raw evidence behind the judgment (computed style values, row/column counts, overflow ratios, etc.). Always present, even for `unknown`, so misclassifications are debuggable instead of silent. */
	signals: Record<string, unknown>;
	children: readonly LayoutBlock[];
};

/** One viewport preset: a name plus the width passed to `beforePageScan` (height is derived from width, not settable — see `default-viewports.ts`). */
export type ViewportSpec = {
	name: string;
	width: number;
};

/**
 * Result of one pattern detector (`detect-*-pattern.ts`) run against a
 * container's children. `signals` always carries the raw evidence the
 * detector looked at, matched or not, so a rejected detector's reasoning
 * is inspectable too.
 */
export type DetectionResult = {
	matched: boolean;
	/** 0–1. Meaningful only when `matched` is `true`. */
	confidence: number;
	signals: Record<string, unknown>;
};

/** The judgment `resolve-layout-type.ts` attaches to a container: which pattern its children matched, and why. */
export type LayoutTypeResolution = {
	layoutType: LayoutType;
	confidence: number;
	signals: Record<string, unknown>;
};

/** Layout analysis result for one URL at one viewport. */
export type LayoutAnalysisResult = {
	url: string;
	viewport: ViewportSpec;
	/** The selector that resolved the main-content element, or `null` when none matched. */
	mainSelector: string | null;
	/** `null` when no main-content element was found for this URL/viewport. */
	root: LayoutBlock | null;
};
