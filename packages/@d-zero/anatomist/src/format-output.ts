import type { LayoutAnalysisResult, LayoutBlock } from './types.js';

export type InnerHtmlMode = 'all' | 'leaf-only' | 'none';

export type FormatOutputOptions = {
	/** Pretty-print with 2-space indent instead of single-line JSON. Default `false`. */
	pretty?: boolean;
	/** Include each block's `boundingBox`. Default `true`. */
	includeBoundingBox?: boolean;
	/** Which blocks carry `innerHTML`: every block, only leaves, or none. Default `'all'`. */
	innerHtmlMode?: InnerHtmlMode;
};

/**
 * @param block
 * @param options
 */
function transformBlock(
	block: LayoutBlock,
	options: Required<FormatOutputOptions>,
): Record<string, unknown> {
	const isLeaf = block.children.length === 0;
	const includeInnerHtml =
		options.innerHtmlMode === 'all' || (options.innerHtmlMode === 'leaf-only' && isLeaf);

	return {
		layoutType: block.layoutType,
		tagName: block.tagName,
		id: block.id,
		classList: block.classList,
		...(options.includeBoundingBox ? { boundingBox: block.boundingBox } : {}),
		...(includeInnerHtml ? { innerHTML: block.innerHTML } : {}),
		confidence: block.confidence,
		signals: block.signals,
		children: block.children.map((child) => transformBlock(child, options)),
	};
}

/**
 * Formats one `LayoutAnalysisResult` as a JSON string, one result per
 * line by default (JSONL) so a batch run can stream output incrementally
 * rather than buffering the whole run in memory before writing anything.
 *
 * `innerHtmlMode: 'all'` (the default) means recursive blocks duplicate
 * content between a parent and its children — each layer's `innerHTML`
 * is meant to be self-contained ("what does this block look like on its
 * own"), not a non-overlapping partition of the page like
 * `@d-zero/html-distiller`'s AST. `'leaf-only'`/`'none'` trade that
 * self-containment for output size, for callers where duplication across
 * `maxDepth` levels would blow past a reasonable payload size.
 * @param result
 * @param options
 * @example
 * ```ts
 * process.stdout.write(formatResultLine(result) + '\n');
 * ```
 */
export function formatResultLine(
	result: LayoutAnalysisResult,
	options: FormatOutputOptions = {},
): string {
	const resolved: Required<FormatOutputOptions> = {
		pretty: options.pretty ?? false,
		includeBoundingBox: options.includeBoundingBox ?? true,
		innerHtmlMode: options.innerHtmlMode ?? 'all',
	};

	const output = {
		url: result.url,
		viewport: result.viewport,
		mainSelector: result.mainSelector,
		root: result.root ? transformBlock(result.root, resolved) : null,
	};

	return resolved.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
}
