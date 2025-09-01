import type { Sizes } from './types.js';

export const defaultSizes = {
	desktop: { width: 1400 },
	tablet: { width: 768 },
	mobile: { width: 375, resolution: 2 },
} as const satisfies Sizes;

export const devicePresets = {
	desktop: { width: 1400 },
	tablet: { width: 768 },
	mobile: { width: 375, resolution: 2 },
	'desktop-hd': { width: 1920 },
	'desktop-compact': { width: 1280 },
	'mobile-large': { width: 414, resolution: 3 },
	'mobile-small': { width: 320, resolution: 2 },
} as const satisfies Sizes;

/**
 * Create sizes from device preset names
 * @param deviceNames Array of device preset names
 * @returns Sizes object
 */
export function createSizesFromDevices(deviceNames: string[]): Sizes {
	const sizes: Sizes = {};

	for (const name of deviceNames) {
		if (name in devicePresets) {
			sizes[name] = devicePresets[name as keyof typeof devicePresets];
		} else {
			throw new Error(
				`Unknown device preset: ${name}. Available presets: ${Object.keys(devicePresets).join(', ')}`,
			);
		}
	}

	return sizes;
}

/**
 * Parse device names and return device presets
 * @param deviceNames Array of device names or undefined
 * @returns Sizes object or undefined
 */
export function parseDevicesOption(deviceNames?: string[]): Sizes | undefined {
	if (deviceNames && deviceNames.length > 0) {
		return createSizesFromDevices(deviceNames);
	}

	return undefined;
}
