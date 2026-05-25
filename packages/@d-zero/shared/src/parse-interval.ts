import type { DelayOptions } from './delay.js';

/**
 * Parses an interval-style string from CLI arguments into a number or DelayOptions.
 * @param intervalString - The string to parse
 * @param fieldLabel - Optional label embedded in error messages so the same
 *   parser can serve multiple CLI flags (e.g. "interval", "scroll-distance")
 *   while surfacing a context-aware error to the user. Defaults to "interval".
 * @returns Parsed value as number (fixed) or DelayOptions (random range)
 * @throws {Error} if the string format is invalid
 * @example
 * parseInterval("1000") // Returns 1000
 * parseInterval("500-1000") // Returns { random: { min: 500, max: 1000 } }
 * parseInterval("abc", "scroll-distance") // throws "Invalid scroll-distance format: ..."
 */
export function parseInterval(
	intervalString: string | undefined,
	fieldLabel: string = 'interval',
): number | DelayOptions | undefined {
	if (intervalString === undefined || intervalString === '') {
		return undefined;
	}

	const capitalized = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);

	// Check if it contains a hyphen (range format)
	// Only treat as range if it matches the pattern "number-number" (not starting with negative sign)
	if (intervalString.includes('-') && !intervalString.startsWith('-')) {
		const parts = intervalString.split('-');
		if (parts.length !== 2) {
			throw new Error(
				`Invalid ${fieldLabel} format: "${intervalString}". Expected format: "number" or "min-max"`,
			);
		}

		const min = Number.parseInt(parts[0]!, 10);
		const max = Number.parseInt(parts[1]!, 10);

		if (Number.isNaN(min) || Number.isNaN(max)) {
			throw new TypeError(
				`Invalid ${fieldLabel} format: "${intervalString}". Both min and max must be numbers.`,
			);
		}

		if (min >= max) {
			throw new Error(
				`Invalid ${fieldLabel} range: "${intervalString}". min must be less than max.`,
			);
		}

		return { random: { min, max } };
	}

	// Parse as a single number
	// Use Number() to validate the entire string first (catches invalid formats like "12.34.56")
	const numValue = Number(intervalString);
	if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
		throw new TypeError(
			`Invalid ${fieldLabel} format: "${intervalString}". Expected a number or "min-max" format.`,
		);
	}

	// Parse as integer
	const value = Number.parseInt(intervalString, 10);
	if (Number.isNaN(value)) {
		throw new TypeError(
			`Invalid ${fieldLabel} format: "${intervalString}". Expected a number or "min-max" format.`,
		);
	}

	if (value < 0) {
		throw new Error(
			`Invalid ${fieldLabel} value: "${intervalString}". ${capitalized} must be non-negative.`,
		);
	}

	return value;
}
