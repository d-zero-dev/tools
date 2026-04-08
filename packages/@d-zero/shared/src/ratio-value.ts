/**
 * Represents a value with both absolute and relative representations.
 * The invariant is: absNumber / maxAbsNumber === relNumber
 */
export type RatioValue = {
	/** Absolute value */
	absNumber: number;
	/** Maximum absolute value */
	maxAbsNumber: number;
	/** Relative value (0...1) */
	relNumber: number;
	/** Maximum relative value (always 1, immutable) */
	maxRelNumber: 1;
};

/**
 * Property names of RatioValue
 */
export type RatioValuePropertyName = keyof RatioValue;

/**
 * Updates a RatioValue object, automatically recalculating dependent properties
 * to maintain the invariant: absNumber / maxAbsNumber === relNumber
 * @param obj - The RatioValue object to update
 * @param propName - The property name to update
 * @param value - The new value for the property
 * @returns A new RatioValue object with updated values
 * @throws {Error} if attempting to update maxRelNumber (immutable)
 * @example
 * const obj = {
 *   absNumber: 100,
 *   maxAbsNumber: 200,
 *   relNumber: 0.5,
 *   maxRelNumber: 1
 * };
 *
 * // Update absNumber -> relNumber is recalculated
 * updateRatio(obj, 'absNumber', 50);
 * // => { absNumber: 50, relNumber: 0.25, ... }
 *
 * // Update relNumber -> absNumber is recalculated
 * updateRatio(obj, 'relNumber', 0.75);
 * // => { absNumber: 150, relNumber: 0.75, ... }
 */
export function updateRatio(
	obj: RatioValue,
	propName: Exclude<RatioValuePropertyName, 'maxRelNumber'>,
	value: number,
): RatioValue {
	const updated = {
		// Create a shallow copy
		...obj,

		// Update the specified property
		[propName]: value,
	};

	// Recalculate dependent properties based on which property was updated
	switch (propName) {
		case 'absNumber': {
			// absNumber changed -> recalculate relNumber
			updated.relNumber = updated.absNumber / updated.maxAbsNumber;

			break;
		}
		case 'relNumber': {
			// relNumber changed -> recalculate absNumber
			updated.absNumber = updated.relNumber * updated.maxAbsNumber;

			break;
		}
		case 'maxAbsNumber': {
			// maxAbsNumber changed -> recalculate absNumber (maintain relNumber)
			updated.absNumber = updated.relNumber * updated.maxAbsNumber;

			break;
		}
		// No default
	}

	return updated;
}
