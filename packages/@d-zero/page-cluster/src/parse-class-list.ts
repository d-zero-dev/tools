import { alphabeticalComparator } from '@d-zero/shared/sort/alphabetical';

import { isNoiseClass } from './is-noise-class.js';
import { DEFAULT_NOISE_CLASS_PATTERNS } from './noise-class-patterns.js';

/**
 * Splits a `class` attribute value into a deduplicated, optionally
 * noise-filtered, case-insensitively sorted list.
 *
 * Sorting ignores case so `"Beta alpha"` reads as `["alpha", "Beta"]` rather
 * than the code-point order a plain `.sort()` would give.
 * @param classAttr
 * @param filterNoise
 */
export function parseClassList(
	classAttr: string | undefined,
	filterNoise: boolean,
): string[] {
	if (!classAttr) {
		return [];
	}

	const raw = classAttr.trim().split(/\s+/).filter(Boolean);
	const deduped = [...new Set(raw)];
	const filtered = filterNoise
		? deduped.filter((name) => !isNoiseClass(name, DEFAULT_NOISE_CLASS_PATTERNS))
		: deduped;

	return filtered.toSorted(alphabeticalComparator);
}
