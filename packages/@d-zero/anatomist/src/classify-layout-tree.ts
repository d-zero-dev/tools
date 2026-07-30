import type { LayoutBlock, RawLayoutNode } from './types.js';

import { resolveLayoutType } from './resolve-layout-type.js';
import { DEFAULT_MIN_AREA, decideRecursion } from './should-recurse.js';

/**
 * Safety bound on a single-child wrapper chain (`main > div > div > ...`)
 * before {@link classifyNode} gives up collapsing and renders a leaf
 * instead. Not expected to trigger on real markup — it exists only so a
 * pathological or cyclic-looking structure can't hang classification.
 */
const MAX_COLLAPSE_CHAIN = 50;

export type ClassifyLayoutTreeOptions = {
	/** Maximum classification depth (collapsed wrappers don't count — see `should-recurse.ts`). Default `6`. */
	maxDepth?: number;
	/** Minimum child box area (px²) to count as meaningful. Default `800`. */
	minArea?: number;
};

/**
 * @param node
 */
function toLeafBlock(node: RawLayoutNode): LayoutBlock {
	return {
		layoutType: 'leaf',
		tagName: node.tagName,
		id: node.id,
		classList: node.classList,
		boundingBox: node.boundingBox,
		innerHTML: node.innerHTML,
		confidence: 0,
		signals: {},
		children: [],
	};
}

/**
 * @param node
 * @param depth
 * @param options
 */
function classifyNode(
	node: RawLayoutNode,
	depth: number,
	options: Required<ClassifyLayoutTreeOptions>,
): LayoutBlock {
	let current = node;
	let collapseCount = 0;
	let decision = decideRecursion(current, depth, options);

	while (decision.kind === 'collapse' && collapseCount < MAX_COLLAPSE_CHAIN) {
		current = decision.child;
		collapseCount++;
		decision = decideRecursion(current, depth, options);
	}

	if (decision.kind !== 'classify') {
		return toLeafBlock(current);
	}

	const resolution = resolveLayoutType(current, decision.children);
	const children = decision.children.map((child) =>
		classifyNode(child, depth + 1, options),
	);

	return {
		layoutType: resolution.layoutType,
		tagName: current.tagName,
		id: current.id,
		classList: current.classList,
		boundingBox: current.boundingBox,
		innerHTML: current.innerHTML,
		confidence: resolution.confidence,
		signals: resolution.signals,
		children,
	};
}

/**
 * Converts a captured `RawLayoutNode` tree (see `capture-layout-tree.ts`)
 * into a classified `LayoutBlock` tree, by recursively: collapsing
 * single-child wrapper chains, resolving each remaining container's
 * visual layout pattern from its children's geometry, and leaf-ing out at
 * `maxDepth` or when there are no more meaningful children (see
 * `should-recurse.ts` and `resolve-layout-type.ts`).
 *
 * The tree's root itself is never assigned a layout judgment about *its
 * own* placement (there's no parent to place it relative to) — it always
 * starts from `decideRecursion` at depth 0, so it's classified exactly
 * like any other container based on what pattern its own children form.
 * @param root - The captured main-content root (`capture-layout-tree.ts`'s `root`).
 * @param options
 * @example
 * ```ts
 * const block = classifyLayoutTree(root, { maxDepth: 6 });
 * ```
 */
export function classifyLayoutTree(
	root: RawLayoutNode,
	options: ClassifyLayoutTreeOptions = {},
): LayoutBlock {
	return classifyNode(root, 0, {
		maxDepth: options.maxDepth ?? 6,
		minArea: options.minArea ?? DEFAULT_MIN_AREA,
	});
}
