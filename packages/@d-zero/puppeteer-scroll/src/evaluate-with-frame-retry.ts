/**
 * Max attempts for each `page.evaluate` call when it fails with a transient
 * frame error. Chrome may briefly swap or re-attach the main frame during a
 * long scroll or immediately after navigation, even when the target site is
 * not doing anything observable. Three attempts with a 200 ms gap absorbs
 * the typical re-attach window without masking a genuinely broken page.
 */
export const MAX_EVALUATE_RETRIES = 3;
export const DETACHED_RETRY_DELAY_MS = 200;

/**
 * Transient errors that occur when `page.evaluate` lands inside Puppeteer's
 * own frame-swap or session-teardown window. Retrying after a short delay
 * usually succeeds because the new execution context is then in place.
 * @param error - Error caught from `page.evaluate`.
 * @returns `true` when the error is a known transient frame/session error.
 * @example
 * ```ts
 * try {
 *   await page.evaluate(...);
 * } catch (error) {
 *   if (isTransientFrameError(error)) {
 *     // retry after a short delay
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export function isTransientFrameError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return /Attempted to use detached Frame|Session closed|Execution context was destroyed/i.test(
		error.message,
	);
}

/**
 * Retries `evaluator` (typically a `page.evaluate` call) when it fails with
 * a transient frame error. Non-transient errors are re-thrown immediately.
 *
 * Used both inside long-running scroll loops and around the single
 * `page.evaluate` calls that bracket them, so that Chrome's brief
 * post-navigation main-frame swap does not surface as an unrecoverable
 * "Attempted to use detached Frame" error in the caller.
 * @template T - Evaluator return type.
 * @param evaluator - Thunk that performs a single `page.evaluate` call.
 * @returns Whatever `evaluator` returns on success.
 * @example
 * ```ts
 * const scrollHeight = await evaluateWithFrameRetry(() =>
 *   page.evaluate(() => document.body.scrollHeight),
 * );
 * ```
 */
export async function evaluateWithFrameRetry<T>(evaluator: () => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < MAX_EVALUATE_RETRIES; attempt++) {
		try {
			return await evaluator();
		} catch (error) {
			lastError = error;
			if (!isTransientFrameError(error)) throw error;
			await new Promise((resolve) => setTimeout(resolve, DETACHED_RETRY_DELAY_MS));
		}
	}
	throw lastError;
}
