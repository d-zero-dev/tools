import type { RawLayoutNode } from './types.js';

import { parseDisplay } from './parse-display.js';

/** Minimum box area (px²) for a child to count as "meaningful" — below this, treat it as decorative noise (icons, spacers) rather than a layout participant. */
export const DEFAULT_MIN_AREA = 800;

/**
 * A node this classify pass should render as a leaf (no further
 * recursion — its `innerHTML` speaks for it).
 */
export type LeafDecision = { kind: 'leaf' };

/**
 * A node with exactly one meaningful child: the wrapper itself isn't
 * counted as a layout block (see module JSDoc), so classification should
 * skip it and continue from `child`.
 */
export type CollapseDecision = { kind: 'collapse'; child: RawLayoutNode };

/** A node whose meaningful children should be geometrically classified. */
export type ClassifyDecision = { kind: 'classify'; children: readonly RawLayoutNode[] };

export type RecurseDecision = LeafDecision | CollapseDecision | ClassifyDecision;

/**
 * @param node
 */
function isInlineLevel(node: RawLayoutNode): boolean {
	const parsed = parseDisplay(node.style.display);
	return parsed.kind === 'box-generating' && parsed.outside === 'inline';
}

/**
 * Collects a node's "meaningful" children: visible, non-zero-area, and
 * with `display: contents` wrappers transparently flattened away (a
 * `contents` box generates no box of its own, so its children are
 * promoted to this level — recursively, in case of a `contents` chain).
 * @param node
 * @param minArea
 */
function getMeaningfulChildren(node: RawLayoutNode, minArea: number): RawLayoutNode[] {
	const result: RawLayoutNode[] = [];
	for (const child of node.children) {
		const parsed = parseDisplay(child.style.display);
		if (parsed.kind === 'none') {
			continue;
		}
		if (child.style.visibility === 'hidden') {
			continue;
		}
		if (child.boundingBox.width * child.boundingBox.height < minArea) {
			continue;
		}
		if (parsed.kind === 'contents') {
			result.push(...getMeaningfulChildren(child, minArea));
			continue;
		}
		result.push(child);
	}
	return result;
}

/**
 * Decides how classification should treat one node's children: stop here
 * (`leaf`), skip this wrapper and continue from its one meaningful child
 * (`collapse`), or classify these children geometrically (`classify`).
 *
 * WHY collapse single-child wrappers instead of leaf-ing at "fewer than 2
 * children": real pages are almost always
 * `main > div.inner > div.container > ...` — a single-wrapper chain before
 * any actual content block. Treating "1 meaningful child" as a leaf would
 * end classification right after the root on nearly every page. Treating
 * it as collapse lets the caller (`classify-layout-tree.ts`) walk through
 * the wrapper chain without counting it toward `maxDepth`, which is meant
 * to bound *content* nesting, not incidental markup wrapping.
 *
 * A majority-inline child set is leaf'd rather than classified because
 * geometric clustering on inline runs (a tag cloud, links inside a
 * paragraph) reads as an irregular grid — this is prose flow, not a
 * layout the tool should report a pattern for.
 * @param node
 * @param depth - Classification depth so far (collapsed wrappers don't increment this — see above).
 * @param options
 * @param options.maxDepth
 * @param options.minArea
 * @example
 * ```ts
 * const decision = decideRecursion(node, 0, { maxDepth: 6, minArea: 800 });
 * if (decision.kind === 'classify') { ... }
 * ```
 */
export function decideRecursion(
	node: RawLayoutNode,
	depth: number,
	options: { maxDepth: number; minArea?: number },
): RecurseDecision {
	const minArea = options.minArea ?? DEFAULT_MIN_AREA;
	const meaningfulChildren = getMeaningfulChildren(node, minArea);

	if (meaningfulChildren.length === 0) {
		return { kind: 'leaf' };
	}

	if (meaningfulChildren.length === 1) {
		return { kind: 'collapse', child: meaningfulChildren[0]! };
	}

	const inlineCount = meaningfulChildren.filter((child) => isInlineLevel(child)).length;
	if (inlineCount > meaningfulChildren.length / 2) {
		return { kind: 'leaf' };
	}

	if (depth >= options.maxDepth) {
		return { kind: 'leaf' };
	}

	return { kind: 'classify', children: meaningfulChildren };
}
