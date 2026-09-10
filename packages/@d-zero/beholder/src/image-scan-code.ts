/**
 * Numeric outcome codes for a single device-preset image scan performed by
 * `Scraper#fetchImages`. Small integers (fit a `Uint8`) so callers that
 * persist per-page scan results to a database column can use an integer
 * rather than a string enum. A `null` value (not part of this const) means
 * the device preset was never attempted — non-HTML/external/non-HTTP pages,
 * or `captureImages: false`.
 * @example
 * ```ts
 * import { IMAGE_SCAN_CODE } from '@d-zero/beholder';
 *
 * db.insert({ imageScanMobile: pageData.imageScan.mobile ?? null });
 * if (pageData.imageScan.mobile === IMAGE_SCAN_CODE.SCROLL_HEIGHT_EXCEEDED) {
 *   // mobile images were skipped because scrollHeight exceeded the limit
 * }
 * ```
 */
export const IMAGE_SCAN_CODE = {
	/** `beforePageScan` reached `settled: 'idle'`; images extracted normally. */
	OK: 0,
	/** `beforePageScan` reached `settled: 'degraded'`; images extracted, but navigation never went network-idle so the result carries lower confidence. */
	DEGRADED: 1,
	/** Navigation never settled and the post-timeout frame/URL/readyState check also failed (`NavigationUnsettledError`). */
	NAV_UNSETTLED: 2,
	/** The main frame or session was lost mid-scan (detached Frame, session closed, execution context destroyed, or "Not attached to an active page"). */
	FRAME_LOST: 3,
	/** `document.body.scrollHeight` exceeded the scan's `maxScrollHeight` guard; scroll and extraction were skipped. */
	SCROLL_HEIGHT_EXCEEDED: 4,
	/** An error occurred that does not match any of the categories above. */
	UNKNOWN: 255,
} as const;

/** Numeric outcome code for one device preset's image scan. See {@link IMAGE_SCAN_CODE}. */
export type ImageScanCode = (typeof IMAGE_SCAN_CODE)[keyof typeof IMAGE_SCAN_CODE];
