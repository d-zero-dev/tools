import type { DelayOptions } from './delay.js';

/**
 * Parses an interval string from CLI arguments into a number or DelayOptions.
 * @param intervalString - The interval string to parse
 * @returns Parsed interval as number (fixed) or DelayOptions (random range)
 * @throws Error if the string format is invalid
 * @example
 * parseInterval("1000") // Returns 1000
 * parseInterval("500-1000") // Returns { random: { min: 500, max: 1000 } }
 */
export function parseInterval(
	intervalString: string | undefined,
): number | DelayOptions | undefined {
	if (intervalString === undefined || intervalString === '') {
		return undefined;
	}

	// Check if it contains a hyphen (range format)
	// Only treat as range if it matches the pattern "number-number" (not starting with negative sign)
	if (intervalString.includes('-') && !intervalString.startsWith('-')) {
		const parts = intervalString.split('-');
		if (parts.length !== 2) {
			throw new Error(
				`Invalid interval format: "${intervalString}". Expected format: "number" or "min-max"`,
			);
		}

		const min = Number.parseInt(parts[0]!, 10);
		const max = Number.parseInt(parts[1]!, 10);

		if (Number.isNaN(min) || Number.isNaN(max)) {
			throw new TypeError(
				`Invalid interval format: "${intervalString}". Both min and max must be numbers.`,
			);
		}

		if (min >= max) {
			throw new Error(
				`Invalid interval range: "${intervalString}". min must be less than max.`,
			);
		}

		return { random: { min, max } };
	}

	// Parse as a single number
	// Use Number() to validate the entire string first (catches invalid formats like "12.34.56")
	const numValue = Number(intervalString);
	if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
		throw new TypeError(
			`Invalid interval format: "${intervalString}". Expected a number or "min-max" format.`,
		);
	}

	// Parse as integer
	const value = Number.parseInt(intervalString, 10);
	if (Number.isNaN(value)) {
		throw new TypeError(
			`Invalid interval format: "${intervalString}". Expected a number or "min-max" format.`,
		);
	}

	if (value < 0) {
		throw new Error(
			`Invalid interval value: "${intervalString}". Interval must be non-negative.`,
		);
	}

	return value;
}
