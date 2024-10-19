import { delay } from '@d-zero/shared/delay';
import { GaxiosError } from 'gaxios';

import { log } from '../debug.js';

const REQUESTS_PER_USER_PER_SECONDS = 100;

const errorLog = log.extend('Error');
const gaxiosErrorLog = log.extend('GaxiosError');

export type ErrorHandlerMessage = {
	readonly message: string;
	readonly waitTime?: number;
	readonly waiting?: boolean;
	readonly code?: string | number;
	readonly error?: Error;
};

export type ErrorHandlerOptions<C> = {
	readonly log: (this: C, message: ErrorHandlerMessage) => void;
};

export function ErrorHandler<C extends object>(options?: ErrorHandlerOptions<C>) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return (method: Function, context: ClassMethodDecoratorContext) => {
		return async function callee(
			this: C,
			...args: unknown[]
		): // eslint-disable-next-line @typescript-eslint/no-explicit-any
		Promise<any> {
			try {
				const result = await method.apply(this, args);
				return result;
			} catch (error) {
				if (error instanceof GaxiosError) {
					if (
						error.message.includes('This operation is not supported for this document')
					) {
						error.message = `${error.message}\n⚠️ Hint: This error may occur when accessing a file that is not a Google Spreadsheet file, such as an Excel file.`;
					}

					if (isTooManyRequestError(error)) {
						const waitTime = (REQUESTS_PER_USER_PER_SECONDS + 10) * 1000;
						const statusText = error.response?.statusText || 'Error';
						if (options?.log) {
							options.log.call(this, {
								message: 'TooManyRequestError',
								waitTime,
								waiting: true,
								code: error.code,
								error,
							});
						} else {
							gaxiosErrorLog(
								`TooManyRequestError: Waiting ${waitTime}ms for ${statusText}`,
							);
						}

						await delay(waitTime);

						options?.log.call(this, {
							message: 'TooManyRequestError',
							waitTime,
							waiting: false,
							code: error.code,
							error,
						});

						return await callee.call(this, args);
					}

					if (userRateLimitExceededError(error)) {
						const waitTime = 60 * 1000;
						const statusText = error.response?.statusText || 'Error';

						if (options?.log) {
							options.log.call(this, {
								message: 'UserRateLimitExceededError',
								waitTime,
								waiting: true,
								code: error.code,
								error,
							});
						} else {
							gaxiosErrorLog(
								`UserRateLimitExceededError: Waiting ${waitTime}ms for ${statusText}`,
							);
						}

						await delay(waitTime);

						options?.log.call(this, {
							message: 'UserRateLimitExceededError',
							waitTime,
							waiting: false,
							code: error.code,
							error,
						});

						return await callee.call(this, args);
					}

					if (error.code === 'ECONNRESET') {
						const waitTime = 5 * 1000;
						const statusText = error.response?.statusText || 'Error';

						if (options?.log) {
							options.log.call(this, {
								message: 'ECONNRESET',
								waitTime,
								waiting: true,
								code: error.code,
								error,
							});
						} else {
							gaxiosErrorLog(`ECONNRESET: Waiting ${waitTime}ms for ${statusText}`);
						}

						await delay(waitTime);

						options?.log.call(this, {
							message: 'ECONNRESET',
							waitTime,
							waiting: false,
							code: error.code,
							error,
						});

						return await callee.call(this, args);
					}
				}
				errorLog(`Caught by decorator in: ${String(context.name)}.${method.name}()`);
				throw error;
			}
		};
	};
}

function userRateLimitExceededError(res: GaxiosError) {
	return (
		Number.parseInt(res.code ?? '') === 403 &&
		res.message.includes('User rate limit exceeded')
	);
}

function isTooManyRequestError(res: GaxiosError) {
	return Number.parseInt(res.code ?? '') === 429;
}
