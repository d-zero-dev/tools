import { alphabeticalComparator } from '@d-zero/shared/sort/alphabetical';

import { isNoiseClass } from './is-noise-class.js';
import { DEFAULT_NOISE_CLASS_PATTERNS } from './noise-class-patterns.js';

/**
 * Splits a `class` attribute value into a deduplicated, optionally
 * noise-filtered, case-insensitively sorted list.
 *
 * Sorting ignores case so `"Beta alpha"` reads as `["alpha", "Beta"]` rather
 * than the code-point order a plain `.sort()` would give.
 *
 * `allowedClasses`, when given, is applied after the noise filter: any class
 * not in the set is dropped (see `TokenizeOptions.allowedClasses`).
 * @param classAttr
 * @param filterNoise
 * @param allowedClasses
 */
export function parseClassList(
	classAttr: string | undefined,
	filterNoise: boolean,
	allowedClasses?: ReadonlySet<string>,
): string[] {
	if (!classAttr) {
		return [];
	}

	const raw = classAttr.trim().split(/\s+/).filter(Boolean);
	const deduped = [...new Set(raw)];
	const noiseFiltered = filterNoise
		? deduped.filter((name) => !isNoiseClass(name, DEFAULT_NOISE_CLASS_PATTERNS))
		: deduped;
	const filtered = allowedClasses
		? noiseFiltered.filter((name) => allowedClasses.has(name))
		: noiseFiltered;

	return filtered.toSorted(alphabeticalComparator);
}
