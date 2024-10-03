import type { Sizes } from './types.js';

export const defaultSizes = {
	desktop: { width: 1400 },
	tablet: { width: 768 },
	mobile: { width: 375, resolution: 2 },
} as const satisfies Sizes;
