/**
 * Thrown by `navigateWithFallback` when the `networkidle2` fallback also
 * times out and the post-timeout frame/URL/readyState check fails. Distinct
 * from a plain `Error` so callers can classify "navigation never settled"
 * separately from frame-loss errors (`Attempted to use detached Frame`,
 * `Session closed`, etc.) without parsing message strings.
 * @example
 * ```ts
 * try {
 *   await beforePageScan(page, url, options);
 * } catch (error) {
 *   if (error instanceof NavigationUnsettledError) {
 *     // navigation never reached an idle or usable state
 *   }
 * }
 * ```
 */
export class NavigationUnsettledError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'NavigationUnsettledError';
	}
}
