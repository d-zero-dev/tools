/**
 * Represents the result of a race between a promise and a timeout.
 */
export type RaceWithTimeoutResult<T> =
	| {
			result: T;
			timeout: false;
	  }
	| {
			result: undefined;
			timeout: true;
	  };

/**
 * Executes a given promise and races it against a timeout. If the promise resolves before the timeout,
 * the result of the promise is returned. If the timeout occurs first, a timeout result is returned.
 *
 * @template T - The type of the result that the promise resolves to.
 * @param promise - A function that returns a promise or a value of type T.
 * @param timeout - The timeout duration in milliseconds.
 * @returns A promise that resolves to an object containing either the result of the promise or a timeout flag.
 *
 * @example
 * ```ts
 * const { result, timeout } = await raceWithTimeout(() => fetchData(), 5000);
 * if (timeout) {
 *   console.log('Operation timed out');
 * } else {
 *   console.log('Operation succeeded with result:', result);
 * }
 * ```
 */
export async function raceWithTimeout<T>(
	promise: () => Promise<T> | T,
	timeout: number,
): Promise<RaceWithTimeoutResult<T>> {
	let timeoutId: NodeJS.Timeout | undefined;

	const timer = async () => {
		await new Promise<void>((r) => {
			timeoutId = setTimeout(r, timeout);
		});
		return { result: undefined, timeout: true } as const;
	};

	const charanger = async () => {
		const result: T = await promise();
		return { result, timeout: false } as const;
	};

	const result = await Promise.race([timer(), charanger()]);
	if (timeoutId) {
		clearTimeout(timeoutId);
	}

	return result;
}
