/**
 * Delays the execution of code by the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to delay.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(ms: number) {
	return new Promise<void>((r) => setTimeout(r, ms));
}
