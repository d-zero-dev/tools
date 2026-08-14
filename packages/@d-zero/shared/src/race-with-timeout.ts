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
 * @template T - The type of the result that the promise resolves to.
 * @param promise - A function that returns a promise or a value of type T.
 * @param timeout - The timeout duration in milliseconds.
 * @returns A promise that resolves to an object containing either the result of the promise or a timeout flag.
 * @example
 * ```ts
 * const { result, timeout } = await raceWithTimeout(() => fetchData(), 5000);
 * if (timeout) {
 *   console.log('Operation timed out');
 * } else {
 *   console.log('Operation succeeded with result:', result);
 * }
 * ```
 * @todo `vi.useFakeTimers()`（@sinonjs/fake-timers）のフェイク Timeout が
 * `Symbol.dispose` を実装したら、try/finally を撤去して
 * `using timeoutId = setTimeout(...)` に移行する（Node 24 のネイティブ Timeout は
 * 実装済みだが、フェイクタイマー環境で壊れるため採用していない）。
 */
export async function raceWithTimeout<T>(
	promise: () => Promise<T> | T,
	timeout: number,
): Promise<RaceWithTimeoutResult<T>> {
	const { promise: timeoutSignal, resolve: onTimeout } = Promise.withResolvers<void>();
	const timeoutId = setTimeout(onTimeout, timeout);

	const timer = async () => {
		await timeoutSignal;
		return { result: undefined, timeout: true } as const;
	};

	const challenger = async () => {
		const result: T = await promise();
		return { result, timeout: false } as const;
	};

	// finally により、challenger 側が reject して Promise.race が早期に throw
	// してもタイマーが必ず解放される。finally の外に clearTimeout を置くと
	// reject 経路で到達せず、タイマーが最大 timeout ms 生存する。
	try {
		return await Promise.race([timer(), challenger()]);
	} finally {
		clearTimeout(timeoutId);
	}
}
