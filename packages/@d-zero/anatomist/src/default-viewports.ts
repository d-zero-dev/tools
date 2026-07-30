import type { ViewportSpec } from './types.js';

/**
 * Default viewport presets, ordered largest to smallest.
 *
 * WHY this order: pages are reloaded once and then have their viewport
 * resized in place across presets (see `analyze-page-layout.ts`) rather
 * than reloaded per preset. Resizing down from a desktop layout mirrors
 * how a real browser window shrinks and lets already-loaded images/fonts
 * stay in place; resizing up from mobile first can leave a page that
 * lazy-loads content only above a certain viewport width with holes that
 * a later downsize wouldn't fill back in.
 */
export const DEFAULT_VIEWPORTS: readonly ViewportSpec[] = [
	{ name: 'pc', width: 1280 },
	{ name: 'tablet', width: 768 },
	{ name: 'sp', width: 375 },
];
