import type { LayoutTypeResolution, RawLayoutNode } from './types.js';

import { clusterIntoRows } from './cluster-into-rows.js';
import { detectFloatWrapPattern } from './detect-float-wrap-pattern.js';
import { detectGridPattern } from './detect-grid-pattern.js';
import { detectHorizontalRowPattern } from './detect-horizontal-row-pattern.js';
import { detectTablePattern } from './detect-table-pattern.js';
import { detectVerticalStackPattern } from './detect-vertical-stack-pattern.js';
import { maxOf } from './max-of.js';

/**
 * Beyond this multiple of the container's own box, a child's box is
 * treated as evidence of carousel/slider `transform` geometry rather than
 * a real layout — see {@link checkOverflow}.
 */
const MAX_OVERFLOW_RATIO = 1.5;

/**
 * Guards against carousels/sliders: `getBoundingClientRect` reports
 * `transform`-shifted geometry, so a slider that lays its slides out in
 * one wide row and translates them off-screen looks, geometrically, like
 * an enormous `horizontal-row` that blows past its parent's box. Rather
 * than confidently mislabel that, treat a large overflow as a sign the
 * geometry isn't trustworthy for classification and fall through to
 * `unknown`.
 * @param container
 * @param children
 */
function checkOverflow(
	container: RawLayoutNode,
	children: readonly RawLayoutNode[],
): { overflowing: boolean; signals: Record<string, unknown> } {
	if (
		children.length === 0 ||
		container.boundingBox.width <= 0 ||
		container.boundingBox.height <= 0
	) {
		return { overflowing: false, signals: {} };
	}

	const maxRight = maxOf(children.map((c) => c.boundingBox.x + c.boundingBox.width));
	const maxBottom = maxOf(children.map((c) => c.boundingBox.y + c.boundingBox.height));
	const overflowRatioX = maxRight / container.boundingBox.width;
	const overflowRatioY = maxBottom / container.boundingBox.height;
	const overflowing =
		overflowRatioX > MAX_OVERFLOW_RATIO || overflowRatioY > MAX_OVERFLOW_RATIO;

	return { overflowing, signals: { overflowRatioX, overflowRatioY } };
}

/**
 * Resolves the visual layout pattern for one container's meaningful
 * children, trying detectors in a fixed priority order and returning the
 * first match. See the module-level detectors for what each pattern means
 * and why the order is what it is:
 *
 * 1. `table` — checked against `container` itself, ahead of everything
 *    else, because a `<table>`'s structure is authoritative regardless of
 *    cell geometry.
 * 2. Overflow guard — see {@link checkOverflow}. Falls through to
 *    `unknown` on trip, skipping every geometric detector below.
 * `children` is clustered into rows exactly once (via `clusterIntoRows`)
 * and shared across every row-based detector below, rather than each
 * detector re-clustering the identical array itself.
 *
 * 3. `complex-grid` / `simple-grid` — checked before `horizontal-row`
 *    because a single-row 1×N grid and an N-item flex row look identical
 *    geometrically; `detect-grid-pattern.ts` only fires at 2+ rows with at
 *    least one multi-column row, so it can't false-positive against a
 *    genuine single row or a plain vertical stack.
 * 4. `float-wrap` — checked before `horizontal-row` on purpose, even
 *    though `float` has no layout effect on a flex/grid item (already
 *    ruled out above): a floated image overlapping wrapped text clusters
 *    into the same single row `detect-horizontal-row-pattern.ts` matches,
 *    so float-wrap must get first refusal or it would never fire.
 * 5. `horizontal-row`
 * 6. `vertical-stack` — the last geometric detector; it also matches a
 *    lone child, so anything reaching this point with one child lands here.
 * 7. `unknown` — no detector matched with confidence. Recursion continues
 *    into `unknown` containers (unlike every matched type) since a
 *    misjudged container's children may still be classifiable.
 * @param container - The node whose children are being classified (used
 *   only for the table check and the overflow guard's own box).
 * @param children - The container's meaningful children (see `should-recurse.ts`).
 * @example
 * ```ts
 * resolveLayoutType(node, node.children); // { layoutType: 'horizontal-row', confidence: 0.8, signals: {...} }
 * ```
 */
export function resolveLayoutType(
	container: RawLayoutNode,
	children: readonly RawLayoutNode[],
): LayoutTypeResolution {
	const tableResult = detectTablePattern(container);
	if (tableResult.matched) {
		return {
			layoutType: 'table',
			confidence: tableResult.confidence,
			signals: tableResult.signals,
		};
	}

	const overflow = checkOverflow(container, children);
	if (overflow.overflowing) {
		return { layoutType: 'unknown', confidence: 0, signals: overflow.signals };
	}

	const rows = clusterIntoRows(children);

	const gridResult = detectGridPattern(rows, children);
	if (gridResult.matched) {
		return {
			layoutType: gridResult.variant === 'complex' ? 'complex-grid' : 'simple-grid',
			confidence: gridResult.confidence,
			signals: gridResult.signals,
		};
	}

	const floatResult = detectFloatWrapPattern(children);
	if (floatResult.matched) {
		return {
			layoutType: 'float-wrap',
			confidence: floatResult.confidence,
			signals: floatResult.signals,
		};
	}

	const rowResult = detectHorizontalRowPattern(rows, children.length);
	if (rowResult.matched) {
		return {
			layoutType: 'horizontal-row',
			confidence: rowResult.confidence,
			signals: rowResult.signals,
		};
	}

	const stackResult = detectVerticalStackPattern(rows, children.length);
	if (stackResult.matched) {
		return {
			layoutType: 'vertical-stack',
			confidence: stackResult.confidence,
			signals: stackResult.signals,
		};
	}

	return {
		layoutType: 'unknown',
		confidence: 0,
		signals: { childCount: children.length },
	};
}
