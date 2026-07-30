import type { ViewportSpec } from './types.js';

import { DEFAULT_VIEWPORTS } from './default-viewports.js';
import { parseViewportSpec } from './parse-viewport-spec.js';

/**
 * Resolves the viewport list to analyze: explicit `--viewport` specs when
 * given, otherwise `DEFAULT_VIEWPORTS`. Specs fully replace the default
 * list rather than adding to it — a caller who names one custom viewport
 * almost certainly wants only that one, not it plus the three presets.
 * @param specs - Raw `"name:width"` strings from repeated `--viewport` flags.
 * @example
 * ```ts
 * resolveViewports([]); // DEFAULT_VIEWPORTS
 * resolveViewports(['wide:1920']); // [{ name: 'wide', width: 1920 }]
 * ```
 */
export function resolveViewports(specs: readonly string[]): readonly ViewportSpec[] {
	if (specs.length === 0) {
		return DEFAULT_VIEWPORTS;
	}
	return specs.map((spec) => parseViewportSpec(spec));
}
