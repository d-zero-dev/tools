import { randomInt, type RandomIntRange } from './random-int.js';

/**
 * Preset distribution types for random sampling.
 */
export type DistributionPreset =
	| 'uniform'
	| 'normal'
	| 'triangular'
	| 'right-skewed'
	| 'left-skewed';

/**
 * Bimodal distribution configuration with peak positions.
 */
export type BimodalDistribution = {
	type: 'bimodal';
	/**
	 * Peak positions normalized to [0,1].
	 * Defaults to [0.25, 0.75] if not specified.
	 */
	peaks?: [number, number];
};

/**
 * Custom distribution configuration with a weight function.
 */
export type CustomDistribution = {
	type: 'custom';
	/**
	 * Weight function that maps normalized position [0,1] to weight [0,∞).
	 * Higher weight means higher probability.
	 * @param t - Normalized position in range [0,1]
	 * @returns Weight value (should be >= 0)
	 */
	weight: (t: number) => number;
};

/**
 * Sample from a normal distribution using Box-Muller transform.
 * @param mean - Mean of the distribution
 * @param stdDev - Standard deviation
 * @returns A sample from normal distribution
 */
function sampleNormal(mean: number, stdDev: number): number {
	const u1 = Math.random();
	const u2 = Math.random();
	const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	return mean + stdDev * z0;
}

/**
 * Sample from a triangular distribution.
 * @param min - Minimum value
 * @param max - Maximum value
 * @param mode - Mode (peak) position, defaults to center
 * @returns A sample from triangular distribution
 */
function sampleTriangular(min: number, max: number, mode?: number): number {
	const m = mode ?? (min + max) / 2;
	const u = Math.random();
	if (u < (m - min) / (max - min)) {
		return min + Math.sqrt(u * (max - min) * (m - min));
	}
	return max - Math.sqrt((1 - u) * (max - min) * (max - m));
}

/**
 * Sample from a bimodal distribution (mixture of two normal distributions).
 * @param min - Minimum value
 * @param max - Maximum value
 * @param peaks - Peak positions normalized to [0,1], defaults to [0.25, 0.75]
 * @returns A sample from bimodal distribution
 */
function sampleBimodal(
	min: number,
	max: number,
	peaks: [number, number] = [0.25, 0.75],
): number {
	const range = max - min;
	const mean1 = min + peaks[0] * range;
	const mean2 = min + peaks[1] * range;
	const stdDev = range / 12; // Smaller stdDev to keep peaks separated

	// Randomly choose one of the two peaks
	const peak = Math.random() < 0.5 ? 0 : 1;
	const mean = peak === 0 ? mean1 : mean2;
	return sampleNormal(mean, stdDev);
}

/**
 * Sample from right-skewed distribution (linear weight: w(t) = t).
 * Uses analytical inverse CDF: t = sqrt(u) where u is uniform [0,1].
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns A random integer within [min, max)
 */
function sampleRightSkewed(min: number, max: number): number {
	const u = Math.random();
	// CDF(t) = t^2, inverse: t = sqrt(u)
	const t = Math.min(1, Math.max(0, Math.sqrt(u)));
	return Math.min(max - 1, Math.floor(min + t * (max - min)));
}

/**
 * Sample from left-skewed distribution (linear weight: w(t) = 1-t).
 * Uses analytical inverse CDF: t = 1 - sqrt(1-u) where u is uniform [0,1].
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns A random integer within [min, max)
 */
function sampleLeftSkewed(min: number, max: number): number {
	const u = Math.random();
	// CDF(t) = 2t - t^2, inverse: t = 1 - sqrt(1-u)
	const t = Math.min(1, Math.max(0, 1 - Math.sqrt(1 - u)));
	return Math.min(max - 1, Math.floor(min + t * (max - min)));
}

/**
 * Calculate the integral of weight function using numerical integration (midpoint rule).
 * @param weightFn - Weight function mapping [0,1] to a non-negative value
 * @param samples - Number of subdivision points for numerical integration
 * @returns Approximate integral of the weight function over [0,1]
 */
function integrateWeight(
	weightFn: (t: number) => number,
	samples: number = 1000,
): number {
	let integral = 0;
	const dt = 1 / samples;
	for (let i = 0; i < samples; i++) {
		const t = (i + 0.5) * dt; // Midpoint rule
		integral += weightFn(t) * dt;
	}
	return integral;
}

/**
 * Sample from a distribution using inverse transform sampling with custom weight function.
 * This uses numerical integration for arbitrary weight functions.
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @param weightFn - Weight function mapping [0,1] to [0,∞)
 * @returns A random integer within [min, max)
 */
function sampleCustomWeight(
	min: number,
	max: number,
	weightFn: (t: number) => number,
): number {
	// Pre-calculate integral for normalization
	const integral = integrateWeight(weightFn);

	// Generate uniform random variable
	const u = Math.random();

	// Find t such that CDF(t) = u using binary search
	let low = 0;
	let high = 1;
	const tolerance = 1e-6;
	const maxIterations = 100;

	for (let i = 0; i < maxIterations; i++) {
		const mid = (low + high) / 2;

		// Calculate CDF(mid) = ∫[0,mid] weight(t) dt / ∫[0,1] weight(t) dt
		let cdfValue = 0;
		const samples = 100;
		const dt = mid / samples;
		for (let j = 0; j < samples; j++) {
			const t = (j + 0.5) * dt;
			cdfValue += weightFn(t) * dt;
		}
		cdfValue /= integral;

		if (Math.abs(cdfValue - u) < tolerance) {
			return Math.min(max - 1, Math.floor(min + mid * (max - min)));
		}

		if (cdfValue < u) {
			low = mid;
		} else {
			high = mid;
		}
	}

	// Fallback: use midpoint if convergence fails
	const t = (low + high) / 2;
	return Math.min(max - 1, Math.floor(min + t * (max - min)));
}

/**
 * Samples a random integer from the specified distribution within the given range.
 * When min >= max, returns min regardless of the distribution type.
 * @param range - Random range specification
 * @param distribution - Distribution type or custom configuration
 * @returns A random integer within [min, max) following the distribution, or min when min >= max
 */
export function sampleDistribution(
	range: RandomIntRange,
	distribution?: DistributionPreset | BimodalDistribution | CustomDistribution,
): number {
	const min = typeof range === 'number' ? 0 : range.min;
	const max = typeof range === 'number' ? range : range.max;

	// Ensure consistent behavior across all distribution types when range is empty
	if (min >= max) {
		return min;
	}

	// Default to uniform distribution
	if (!distribution || distribution === 'uniform') {
		return randomInt(range);
	}

	if (distribution === 'normal') {
		const mean = (min + max) / 2;
		const stdDev = (max - min) / 6; // ~99.7% within range
		let sample = sampleNormal(mean, stdDev);
		// Clip to range
		sample = Math.max(min, Math.min(max - 1, sample));
		return Math.floor(sample);
	}

	if (distribution === 'triangular') {
		return Math.min(max - 1, Math.floor(sampleTriangular(min, max)));
	}

	if (distribution === 'right-skewed') {
		return sampleRightSkewed(min, max);
	}

	if (distribution === 'left-skewed') {
		return sampleLeftSkewed(min, max);
	}

	if (distribution.type === 'bimodal') {
		const peaks = distribution.peaks ?? [0.25, 0.75];
		let sample = sampleBimodal(min, max, peaks);
		// Clip to range
		sample = Math.max(min, Math.min(max - 1, sample));
		return Math.floor(sample);
	}

	if (distribution.type === 'custom') {
		return sampleCustomWeight(min, max, distribution.weight);
	}

	// Fallback to uniform
	return randomInt(range);
}
