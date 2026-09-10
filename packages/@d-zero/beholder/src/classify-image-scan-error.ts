import { NavigationUnsettledError } from '@d-zero/puppeteer-page-scan';
import { isTransientFrameError } from '@d-zero/puppeteer-scroll';

import { IMAGE_SCAN_CODE, type ImageScanCode } from './image-scan-code.js';

/**
 * Matches session/target-loss error messages observed in `#fetchImages`'s
 * per-device retry that `isTransientFrameError` (`@d-zero/puppeteer-scroll`)
 * does not already cover — specific `reload`/`goto` failures rather than
 * `page.evaluate` failures. Deliberately does NOT match a bare `Protocol
 * error` prefix: that wraps many unrelated CDP failures (e.g. `Protocol
 * error (Runtime.evaluate): stack overflow`) that are not frame/session
 * loss and should fall through to `UNKNOWN` for accurate diagnosis.
 */
const FRAME_LOST_PATTERN = /Not attached to an active page|Target closed/i;

/**
 * Classifies an error caught in `Scraper#fetchImages`'s per-device try/catch
 * into an {@link ImageScanCode}, so the caught-exception path and the
 * successful-scan path (`settled` / `scrolled`) can be recorded with the
 * same small integer vocabulary for persistence.
 * @param error - The value caught from the per-device `beforePageScan` call.
 * @returns {@link IMAGE_SCAN_CODE.NAV_UNSETTLED} for a `NavigationUnsettledError`,
 * {@link IMAGE_SCAN_CODE.FRAME_LOST} for a known frame/session-loss error,
 * otherwise {@link IMAGE_SCAN_CODE.UNKNOWN}.
 * @example
 * ```ts
 * try {
 *   await beforePageScan(page, url, opts);
 * } catch (error) {
 *   imageScan[key] = classifyImageScanError(error);
 * }
 * ```
 */
export function classifyImageScanError(error: unknown): ImageScanCode {
	if (error instanceof NavigationUnsettledError) {
		return IMAGE_SCAN_CODE.NAV_UNSETTLED;
	}
	if (
		isTransientFrameError(error) ||
		(error instanceof Error && FRAME_LOST_PATTERN.test(error.message))
	) {
		return IMAGE_SCAN_CODE.FRAME_LOST;
	}
	return IMAGE_SCAN_CODE.UNKNOWN;
}
