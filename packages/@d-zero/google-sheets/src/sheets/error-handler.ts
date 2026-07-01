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
 * `createErrorHandler` のログコールバックに渡されるメッセージ。
 */
export type ErrorHandlerMessage = {
	readonly message: string;
	readonly waitTime?: number;
	readonly waiting?: boolean;
	readonly code?: string | number;
	readonly error?: Error;
};

/**
 * `createErrorHandler` のオプション。
 *
 * `this` バインディングを行いたい場合は、呼び出し側でクロージャで束縛して渡すこと
 * （例: `log: (msg) => sheets.onLog?.(msg)`）。
 */
export type ErrorHandlerOptions = {
	readonly log: (message: ErrorHandlerMessage) => void;
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

/** Excel ファイルが Google Sheets として開かれた場合のヒント文。 */
const EXCEL_HINT =
	'⚠️ Hint: This error may occur when accessing a file that is not a Google Spreadsheet file, such as an Excel file.';

/**
 * Google Sheets API のエラーを検出し、リトライ可能なエラーに対して
 * 自動的に待機・再試行を行うエラーハンドラを生成する。
 *
 * 返却関数は元処理を関数引数で受け取り、リトライ込みで実行する。
 * リトライカウントは呼び出しごとに独立する（再帰の引数で伝搬）ので、
 * 同一ハンドラへの並列呼び出し間でカウンタが混線しない。
 *
 * リトライ対象:
 * - 429 Too Many Requests（110 秒待機）
 * - 403 User Rate Limit Exceeded（60 秒待機）
 * - 5xx Server Error（30 秒待機）
 * - ECONNRESET（5 秒待機）
 *
 * 最大リトライ回数は {@link MAX_RETRIES} で制限される。
 *
 * Decorator ではなく高階関数として実装しているのは、Vite 8 が同梱する Oxc トランスフォーマが
 * ES (stage-3) decorators の lowering を未サポートのため
 * （{@link https://github.com/oxc-project/oxc/issues/9170}）。
 *
 * 移行に伴い、非リトライ例外時のログプレフィックスは旧 decorator の
 * `Caught by decorator in: ClassName.methodName()` から `Caught in: ClassName.methodName()`
 * に変更されている（"by decorator" は実装的にもう正確でないため）。旧プレフィックスに依存した
 * ログ集約ルール（Datadog monitor、CloudWatch metric filter 等）があれば追従が必要。
 * @param methodName - ログ出力に用いるメソッド名。`ClassName.methodName` の形式で渡すと
 *   旧 decorator 実装と同じ完全修飾ログが残る
 * @param options - ログコールバックを含むオプション（省略時は debug 経由のログのみ）
 */
export function createErrorHandler(methodName: string, options?: ErrorHandlerOptions) {
	/**
	 * 元処理をリトライ込みで実行する。
	 * @param method - リトライ対象の本体処理
	 * @param retryCount - 現在のリトライ回数（再帰の引数として伝搬）
	 */
	async function run<R>(method: () => Promise<R>, retryCount: number): Promise<R> {
		try {
			return await method();
		} catch (error) {
			if (error instanceof GaxiosError) {
				if (
					error.message.includes('This operation is not supported for this document') &&
					!error.message.includes(EXCEL_HINT)
				) {
					error.message = `${error.message}\n${EXCEL_HINT}`;
				}

				const retryable = classifyRetryableError(error);
				if (retryable) {
					const nextRetryCount = retryCount + 1;
					if (nextRetryCount > MAX_RETRIES) {
						errorLog(
							`${retryable.label}: Max retries (${MAX_RETRIES}) exceeded in ${methodName}()`,
						);
						throw error;
					}

					const statusText = error.response?.statusText || 'Error';

					if (options) {
						options.log({
							message: retryable.label,
							waitTime: retryable.waitTime,
							waiting: true,
							code: retryable.code,
							error,
						});
					} else {
						gaxiosErrorLog(
							`${retryable.label}(${retryable.code}): Waiting ${retryable.waitTime}ms for ${statusText} (retry ${nextRetryCount}/${MAX_RETRIES})`,
						);
					}

					await delay(retryable.waitTime);

					if (options) {
						options.log({
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

					return await run(method, nextRetryCount);
				}
			}
			errorLog(`Caught in: ${methodName}()`);
			throw error;
		}
	}

	return <R>(method: () => Promise<R>) => run(method, 0);
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
