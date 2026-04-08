import { delay } from '@d-zero/shared/delay';
import { GaxiosError } from 'gaxios';

import { log } from '../debug.js';

/**
 * Google Sheets API のユーザーあたりのリクエスト制限（リクエスト/秒）。
 * 429 エラー時の待機時間の算出に使用する（(100 + 10) * 1000 = 110秒）。
 * @see https://developers.google.com/sheets/api/limits
 */
const REQUESTS_PER_USER_PER_SECONDS = 100;

/**
 * リトライの最大回数。
 * Google 側の持続的障害時に無限ループしないための安全弁。
 */
const MAX_RETRIES = 10;

const errorLog = log.extend('Error');
const gaxiosErrorLog = log.extend('GaxiosError');

/**
 * ErrorHandler のログコールバックに渡されるメッセージ。
 */
export type ErrorHandlerMessage = {
	readonly message: string;
	readonly waitTime?: number;
	readonly waiting?: boolean;
	readonly code?: string | number;
	readonly error?: Error;
};

/**
 * ErrorHandler デコレータのオプション。
 */
export type ErrorHandlerOptions<C> = {
	readonly log: (this: C, message: ErrorHandlerMessage) => void;
};

/**
 * リトライ可能と判定されたエラーの分類結果。
 */
interface RetryableErrorInfo {
	/** ログに渡すエラー種別ラベル。 */
	readonly label: string;
	/** 待機時間（ミリ秒）。 */
	readonly waitTime: number;
	/** ステータスコードまたはエラーコード。 */
	readonly code: string | number;
}

/**
 * GaxiosError をリトライ可能なエラー種別に分類する。
 * リトライ対象でない場合は `null` を返す。
 * @param error - 分類対象の GaxiosError
 */
function classifyRetryableError(error: GaxiosError): RetryableErrorInfo | null {
	if (isTooManyRequestError(error)) {
		return {
			label: 'TooManyRequestError',
			// 429: レート制限超過。制限値 + マージン 10 秒で待機
			waitTime: (REQUESTS_PER_USER_PER_SECONDS + 10) * 1000,
			code: getStatusCode(error),
		};
	}

	if (userRateLimitExceededError(error)) {
		return {
			label: 'UserRateLimitExceededError',
			// 403 User Rate Limit: Google の推奨に従い 60 秒待機
			waitTime: 60 * 1000,
			code: getStatusCode(error),
		};
	}

	if (isServerError(error)) {
		return {
			label: 'ServerError',
			// 5xx Server Error: Google の推奨「30 秒後にリトライ」に従う
			waitTime: 30 * 1000,
			code: getStatusCode(error),
		};
	}

	if (error.code === 'ECONNRESET') {
		return {
			label: 'ECONNRESET',
			// ECONNRESET: TCP 接続リセット。短い待機で再接続を試みる
			waitTime: 5 * 1000,
			code: error.code,
		};
	}

	return null;
}

/**
 * Google Sheets API のエラーを検出し、リトライ可能なエラーに対して
 * 自動的に待機・再試行を行うメソッドデコレータファクトリ。
 *
 * リトライ対象:
 * - 429 Too Many Requests（110 秒待機）
 * - 403 User Rate Limit Exceeded（60 秒待機）
 * - 5xx Server Error（30 秒待機）
 * - ECONNRESET（5 秒待機）
 *
 * 最大リトライ回数は {@link MAX_RETRIES} で制限される。
 * @param options - ログコールバックを含むオプション
 */
export function ErrorHandler<C extends object>(options?: ErrorHandlerOptions<C>) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	return (method: Function, context: ClassMethodDecoratorContext) => {
		let retryCount = 0;

		return async function callee(
			this: C,
			...args: unknown[]
		): // eslint-disable-next-line @typescript-eslint/no-explicit-any
		Promise<any> {
			try {
				const result = await method.apply(this, args);
				retryCount = 0;
				return result;
			} catch (error) {
				if (error instanceof GaxiosError) {
					if (
						error.message.includes('This operation is not supported for this document')
					) {
						error.message = `${error.message}\n⚠️ Hint: This error may occur when accessing a file that is not a Google Spreadsheet file, such as an Excel file.`;
					}

					const retryable = classifyRetryableError(error);
					if (retryable) {
						retryCount++;
						if (retryCount > MAX_RETRIES) {
							retryCount = 0;
							errorLog(
								`${retryable.label}: Max retries (${MAX_RETRIES}) exceeded in ${String(context.name)}.${method.name}()`,
							);
							throw error;
						}

						const statusText = error.response?.statusText || 'Error';

						if (options?.log) {
							options.log.call(this, {
								message: retryable.label,
								waitTime: retryable.waitTime,
								waiting: true,
								code: retryable.code,
								error,
							});
						} else {
							gaxiosErrorLog(
								`${retryable.label}(${retryable.code}): Waiting ${retryable.waitTime}ms for ${statusText} (retry ${retryCount}/${MAX_RETRIES})`,
							);
						}

						await delay(retryable.waitTime);

						if (options?.log) {
							options.log.call(this, {
								message: retryable.label,
								waitTime: retryable.waitTime,
								waiting: false,
								code: retryable.code,
								error,
							});
						} else {
							gaxiosErrorLog(
								`${retryable.label}(${retryable.code}): Resumed after ${retryable.waitTime}ms`,
							);
						}

						return await callee.apply(this, args);
					}
				}
				retryCount = 0;
				errorLog(`Caught by decorator in: ${String(context.name)}.${method.name}()`);
				throw error;
			}
		};
	};
}

/**
 * 5xx サーバーエラー（502 Bad Gateway, 503 Service Unavailable など）を判定する。
 * @param res
 */
function isServerError(res: GaxiosError) {
	const statusCode = getStatusCode(res);
	return !Number.isNaN(statusCode) && statusCode >= 500 && statusCode < 600;
}

/**
 * HTTP ステータスコードを取得する。
 * `response.status` を優先し、存在しない場合は `code` にフォールバックする。
 * @param res
 */
function getStatusCode(res: GaxiosError): number {
	return res.response?.status ?? toNumber(res.code);
}

/**
 * 403 かつ "User rate limit exceeded" メッセージを含むエラーを判定する。
 * @param res
 */
function userRateLimitExceededError(res: GaxiosError) {
	return getStatusCode(res) === 403 && res.message.includes('User rate limit exceeded');
}

/**
 * 429 Too Many Requests エラーを判定する。
 * @param res
 */
function isTooManyRequestError(res: GaxiosError) {
	return getStatusCode(res) === 429;
}

/**
 * 文字列または数値をステータスコード数値に変換する。
 * @param code
 */
function toNumber(code: string | number | undefined) {
	return typeof code === 'number' ? code : Number.parseInt(code ?? '');
}
