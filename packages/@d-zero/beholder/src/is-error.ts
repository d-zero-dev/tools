/**
 * Determines whether an HTTP status code represents an error.
 * Status codes in the range 200-399 (inclusive) are considered successful;
 * all others are considered errors.
 * @param status - HTTP status code to evaluate
 * @returns `true` if the status code indicates an error (< 200 or >= 400)
 */
export function isError(status: number) {
	return !(200 <= status && status < 400);
}
