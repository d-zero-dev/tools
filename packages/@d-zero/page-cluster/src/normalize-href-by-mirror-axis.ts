import type { MirrorAxis } from './detect-mirror-axis.js';

/**
 * Reduces a URL (typically a stylesheet href) to a shape that is stable
 * across a detected {@link MirrorAxis}, by replacing every `/<value>/`
 * occurrence — for any of the axis's known values — with a fixed
 * placeholder segment. Unlike {@link ./normalize-path-by-mirror-axis.js |
 * normalizePathByMirrorAxis}, this does not anchor on `axis.position`: an
 * href's own path structure (e.g. `/assets/en/style.css`) does not
 * necessarily line up with the page's path depth (e.g. `/en/section/`), so
 * matching is done by substring rather than by segment index. This is what
 * lets a per-mirror stylesheet — the same template's CSS duplicated once per
 * language directory instead of shared from one file — normalize to the
 * same shape as its sibling mirrors, corroborating that two pages under
 * different blocking keys are the same template mirrored rather than two
 * different templates.
 * @param href A URL string (typically a stylesheet href).
 * @param axis A `MirrorAxis` from {@link ./detect-mirror-axis.js | detectMirrorAxis}.
 * @example
 * ```ts
 * const axis = { position: 0, values: new Set(['en', 'zh']) };
 * normalizeHrefByMirrorAxis('https://example.test/en/faq/page.css', axis);
 * // 'https://example.test/{axis}/faq/page.css'
 * ```
 */
export function normalizeHrefByMirrorAxis(href: string, axis: MirrorAxis): string {
	let normalized = href;
	for (const value of axis.values) {
		normalized = normalized.split(`/${value}/`).join('/{axis}/');
	}
	return normalized;
}
