import { delay, type DelayOptions } from './delay.js';

const TIME_NUMBER_DISPLAY = [
	'en-US',
	{
		style: 'decimal',
		useGrouping: true,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	},
] as const;

/**
 * Options for the retry decorator.
 */
export type RetryDecoratorOptions = {
	/**
	 * Number of retries.
	 */
	retries?: number;

	/**
	 * Time to next retry.
	 * Can be a fixed number or a random range for variability.
	 */
	interval?: number | DelayOptions;

	/**
	 * With exponential backoff.
	 * Increments the interval exponentially if set to true.
	 */
	withExponentialBackoff?: boolean;

	/**
	 * Timeout duration for each retry attempt.
	 */
	timeout?: number;

	/**
	 * Fallback value to use if all retries fail.
	 */
	fallback?: unknown;

	/**
	 * Function to log messages during retry attempts.
	 * @param message - The message to log.
	 */
	log?: (message: string) => void;

	/**
	 * Callback invoked when the retry wait begins.
	 * Receives the determined interval (ms), the current retry count, and the method name.
	 * `this` is bound to the decorated instance.
	 * @param determinedInterval - The actual wait time in milliseconds.
	 * @param retryCount - The current retry attempt number (0-based).
	 * @param methodName - The fully qualified method name (e.g., "ClassName.methodName").
	 */
	onWait?: (determinedInterval: number, retryCount: number, methodName: string) => void;

	/**
	 * Callback invoked when all retries are exhausted.
	 * `this` is bound to the decorated instance.
	 * @param retryCount - The total number of retries attempted.
	 * @param error - The first error that triggered retries.
	 * @param methodName - The fully qualified method name (e.g., "ClassName.methodName").
	 */
	onGiveUp?: (retryCount: number, error: Error, methodName: string) => void;
};

/**
 * Decorator factory that adds retry logic to a method.
 * @param options - The options for the retry decorator.
 * @returns A decorator function that can be applied to a method.
 */
export function retry<C extends object>(options?: RetryDecoratorOptions) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return (method: Function, context: ClassMethodDecoratorContext) => {
		const intervalOption = options?.interval ?? 3000;
		const timeoutTime = Math.max(options?.timeout ?? 0, 0);
		const withExponentialBackoff = options?.withExponentialBackoff ?? true;
		return async function (this: C, ...args: unknown[]) {
			// Resolve retries per-call: instance property > decorator option > default 5
			const retries =
				((this as Record<string, unknown>).retries as number | undefined) ??
				options?.retries ??
				5;
			let retryCount = 0;
			let firstTimeError!: Error;
			const constructorName = String(this.constructor?.name || this.constructor || this);
			const methodName = `${constructorName}.${String(context.name)}`;

			while (true) {
				if (retryCount >= retries) {
					const message = `[Retried ${retryCount} times] ${firstTimeError.message}`;
					options?.log?.(message);
					options?.onGiveUp?.call(this, retryCount, firstTimeError, methodName);

					if (options?.fallback) {
						return options.fallback;
					}

					firstTimeError.message = message;
					throw firstTimeError;
				}
				try {
					if (timeoutTime) {
						return await Promise.race([
							method.apply(this, args),
							timeout(
								timeoutTime,
								`Race ${timeoutTime.toLocaleString(...TIME_NUMBER_DISPLAY)}ms vs ${methodName}`,
							),
						]);
					}
					return await method.apply(this, args);
				} catch (error: unknown) {
					if (!(error instanceof Error)) {
						throw error;
					}
					if (retryCount === 0) {
						firstTimeError = error;
					}
					const exp = withExponentialBackoff ? 2 ** retryCount : 1;
					// Calculate wait time with exponential backoff
					const waitTime: number | DelayOptions =
						typeof intervalOption === 'number'
							? Math.max(intervalOption, 0) * exp
							: (() => {
									// For DelayOptions, scale the range by the exponential factor
									const { random } = intervalOption;
									if (typeof random === 'number') {
										// For random: number, scale the max value
										return { random: random * exp };
									}
									// For random: {min, max}, scale both min and max
									return { random: { min: random.min * exp, max: random.max * exp } };
								})();
					if (options?.log) {
						const displayTime =
							typeof waitTime === 'number'
								? waitTime.toLocaleString(...TIME_NUMBER_DISPLAY)
								: typeof waitTime.random === 'number'
									? `0-${waitTime.random}`
									: `${waitTime.random.min}-${waitTime.random.max}`;
						options.log(
							`(${methodName}) Failed ${retryCount + 1} times: ${
								error.message
							}; Wating ${displayTime}ms...`,
						);
					}
					await delay(
						waitTime,
						options?.onWait
							? (determinedInterval) =>
									options.onWait!.call(this, determinedInterval, retryCount, methodName)
							: undefined,
					);
					retryCount++;
				}
			}
		};
	};
}

/**
 *
 * @param time
 * @param message
 */
async function timeout(time: number, message: string) {
	await delay(time);
	throw new RetryTimeoutError(message);
}

/**
 * Represents an error that occurs when a retry operation times out.
 */
export class RetryTimeoutError extends Error {
	override name = 'RetryTimeoutError';
}
