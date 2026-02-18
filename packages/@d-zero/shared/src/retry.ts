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
 * Options for the standalone retry function.
 */
export type RetryCallOptions = {
	/**
	 * Number of retries.
	 * @default 5
	 */
	retries?: number;

	/**
	 * Time to next retry.
	 * Can be a fixed number or a random range for variability.
	 * @default 3000
	 */
	interval?: number | DelayOptions;

	/**
	 * With exponential backoff.
	 * Increments the interval exponentially if set to true.
	 * @default true
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
	 * Label for identifying this retry operation in logs and callbacks.
	 * @default "retryCall"
	 */
	label?: string;

	/**
	 * Callback invoked when the retry wait begins.
	 * @param determinedInterval - The actual wait time in milliseconds.
	 * @param retryCount - The current retry attempt number (0-based).
	 * @param label - The label identifying this retry operation.
	 */
	onWait?: (determinedInterval: number, retryCount: number, label: string) => void;

	/**
	 * Callback invoked when all retries are exhausted.
	 * @param retryCount - The total number of retries attempted.
	 * @param error - The first error that triggered retries.
	 * @param label - The label identifying this retry operation.
	 */
	onGiveUp?: (retryCount: number, error: Error, label: string) => void;
};

/**
 * Options for the retry decorator.
 *
 * Extends {@link RetryCallOptions} but binds `this` in `onWait`/`onGiveUp`
 * to the decorated instance, and uses the method name as the label.
 */
export type RetryDecoratorOptions = Omit<
	RetryCallOptions,
	'label' | 'onWait' | 'onGiveUp'
> & {
	/**
	 * Callback invoked when the retry wait begins.
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
 * Retry an async function with exponential backoff.
 *
 * Standalone version of the {@link retry} decorator — use this when
 * you need per-call context (e.g., a progress callback) that cannot
 * be provided through a class instance.
 * @param fn - The async function to retry.
 * @param options - Retry configuration.
 * @returns The resolved value of `fn`.
 * @example
 * ```ts
 * const result = await retryCall(() => fetchDestination(url), {
 *   retries: 3,
 *   onWait: (interval, count, label) => update(`${label}: retry #${count + 1}`),
 * });
 * ```
 */
export async function retryCall<T>(
	fn: () => Promise<T>,
	options?: RetryCallOptions,
): Promise<T> {
	const retries = options?.retries ?? 5;
	const label = options?.label ?? 'retryCall';
	return retryLoop(fn, retries, label, options);
}

/**
 * Decorator factory that adds retry logic to a method.
 * @param options - The options for the retry decorator.
 * @returns A decorator function that can be applied to a method.
 */
export function retry<C extends object>(options?: RetryDecoratorOptions) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return (method: Function, context: ClassMethodDecoratorContext) => {
		return async function (this: C, ...args: unknown[]) {
			// Resolve retries per-call: instance property > decorator option > default 5
			const retries =
				((this as Record<string, unknown>).retries as number | undefined) ??
				options?.retries ??
				5;
			const constructorName = String(this.constructor?.name || this.constructor || this);
			const methodName = `${constructorName}.${String(context.name)}`;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return retryLoop<any>(() => method.apply(this, args), retries, methodName, {
				...options,
				onWait: options?.onWait
					? (determinedInterval, retryCount, lbl) =>
							options.onWait!.call(this, determinedInterval, retryCount, lbl)
					: undefined,
				onGiveUp: options?.onGiveUp
					? (retryCount, error, lbl) =>
							options.onGiveUp!.call(this, retryCount, error, lbl)
					: undefined,
			});
		};
	};
}

/**
 * Core retry loop shared by {@link retryCall} and {@link retry}.
 * @param fn
 * @param retries
 * @param label
 * @param options
 */
async function retryLoop<T>(
	fn: () => Promise<T>,
	retries: number,
	label: string,
	options?: Omit<RetryCallOptions, 'retries' | 'label'>,
): Promise<T> {
	const intervalOption = options?.interval ?? 3000;
	const timeoutTime = Math.max(options?.timeout ?? 0, 0);
	const withExponentialBackoff = options?.withExponentialBackoff ?? true;

	let retryCount = 0;
	let firstTimeError!: Error;

	while (true) {
		if (retryCount >= retries) {
			const message = `[Retried ${retryCount} times] ${firstTimeError.message}`;
			options?.log?.(message);
			options?.onGiveUp?.(retryCount, firstTimeError, label);

			if (options?.fallback) {
				return options.fallback as T;
			}

			firstTimeError.message = message;
			throw firstTimeError;
		}
		try {
			if (timeoutTime) {
				return await Promise.race([
					fn(),
					timeout(
						timeoutTime,
						`Race ${timeoutTime.toLocaleString(...TIME_NUMBER_DISPLAY)}ms vs ${label}`,
					),
				]);
			}
			return await fn();
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
					`(${label}) Failed ${retryCount + 1} times: ${
						error.message
					}; Wating ${displayTime}ms...`,
				);
			}
			await delay(
				waitTime,
				options?.onWait
					? (determinedInterval) => options.onWait!(determinedInterval, retryCount, label)
					: undefined,
			);
			retryCount++;
		}
	}
}

/**
 *
 * @param time
 * @param message
 */
async function timeout(time: number, message: string): Promise<never> {
	await delay(time);
	throw new RetryTimeoutError(message);
}

/**
 * Represents an error that occurs when a retry operation times out.
 */
export class RetryTimeoutError extends Error {
	override name = 'RetryTimeoutError';
}
