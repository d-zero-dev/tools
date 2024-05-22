import { delay } from './delay.js';

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
	 */
	interval?: number;

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
};

/**
 * Decorator factory that adds retry logic to a method.
 *
 * @param options - The options for the retry decorator.
 * @returns A decorator function that can be applied to a method.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function retry<C extends Object>(options?: RetryDecoratorOptions) {
	// eslint-disable-next-line @typescript-eslint/ban-types
	return (method: Function, context: ClassMethodDecoratorContext) => {
		const retries = options?.retries ?? 5;
		const interval = Math.max(options?.interval ?? 3000, 0);
		const timeoutTime = Math.max(options?.timeout ?? 0, 0);
		const withExponentialBackoff = options?.withExponentialBackoff ?? true;
		let retryCount = 0;
		let firstTimeError: Error;
		return async function (this: C, ...args: unknown[]) {
			const constructorName = String(this.constructor?.name || this.constructor || this);
			const methodName = `${constructorName}.${String(context.name)}`;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				if (retryCount >= retries) {
					const message = `[Retried ${retryCount} times] ${firstTimeError.message}`;
					options?.log?.(message);

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
					const waitTime = interval * exp;
					if (options?.log) {
						options.log(
							`(${methodName}) Failed ${retryCount + 1} times: ${
								error.message
							}; Wating ${waitTime.toLocaleString(...TIME_NUMBER_DISPLAY)}ms...`,
						);
					}
					await delay(waitTime);
					retryCount++;
				}
			}
		};
	};
}

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
