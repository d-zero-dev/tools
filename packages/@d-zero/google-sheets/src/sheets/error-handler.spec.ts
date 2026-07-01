import type { ErrorHandlerOptions } from './error-handler.js';

import { delay } from '@d-zero/shared/delay';
import { GaxiosError } from 'gaxios';
import { describe, test, expect, vi, beforeEach } from 'vitest';

import { createErrorHandler } from './error-handler.js';

vi.mock('@d-zero/shared/delay', () => ({
	delay: vi.fn().mockResolvedValue(),
}));

const { errorLogMock, gaxiosErrorLogMock } = vi.hoisted(() => ({
	errorLogMock: vi.fn(),
	gaxiosErrorLogMock: vi.fn(),
}));

vi.mock('../debug.js', () => {
	const baseLog: ((...args: unknown[]) => void) & {
		extend: (name: string) => (...args: unknown[]) => void;
	} = Object.assign(() => {}, {
		extend(name: string) {
			if (name === 'Error') return errorLogMock;
			if (name === 'GaxiosError') return gaxiosErrorLogMock;
			return () => {};
		},
	});
	return { log: baseLog };
});

/**
 * GaxiosError を生成するヘルパー。
 * @param status HTTP ステータスコード
 * @param message エラーメッセージ
 * @param statusText レスポンスのステータステキスト
 */
function createGaxiosError(
	status: number,
	message = `Request failed with status code ${status}`,
	statusText = 'Error',
) {
	return new GaxiosError(message, { url: 'test' }, {
		status,
		statusText,
		headers: {},
		config: { url: 'test' },
		data: '',
		request: { responseURL: 'test' },
	} as never);
}

/**
 * code プロパティのみを持つ GaxiosError を生成するヘルパー（response なし）。
 * @param code エラーコード
 * @param message エラーメッセージ
 */
function createGaxiosErrorWithCode(code: string, message = 'Error') {
	const error = new GaxiosError(message, { url: 'test' });
	error.code = code;
	return error;
}

/**
 * `createErrorHandler` のリトライ挙動をテストするための対象クラス。
 */
class TestTarget {
	/** メソッドが呼ばれた回数。 */
	callCount = 0;

	/** 呼び出し時にスローするエラーのリスト。空になると成功を返す。 */
	errors: Error[] = [];

	readonly #handle = createErrorHandler('doWork');

	async doWork(): Promise<string> {
		return this.#handle(() => {
			this.callCount++;
			const error = this.errors.shift();
			if (error) {
				throw error;
			}
			return Promise.resolve('success');
		});
	}
}

/**
 * `createErrorHandler` を log オプション付きでテストするクラス。
 */
class TestTargetWithLog {
	/** メソッドが呼ばれた回数。 */
	callCount = 0;

	/** 呼び出し時にスローするエラーのリスト。 */
	errors: Error[] = [];

	/** log コールバックで受け取ったメッセージ。 */
	logMessages: Parameters<ErrorHandlerOptions['log']>[0][] = [];

	readonly #handle = createErrorHandler('doWork', {
		log: (message) => this.logMessages.push(message),
	});

	async doWork(): Promise<string> {
		return this.#handle(() => {
			this.callCount++;
			const error = this.errors.shift();
			if (error) {
				throw error;
			}
			return Promise.resolve('success');
		});
	}
}

beforeEach(() => {
	vi.mocked(delay).mockReset();
	vi.mocked(delay).mockResolvedValue();
	errorLogMock.mockReset();
	gaxiosErrorLogMock.mockReset();
});

describe('createErrorHandler - 5xx Server Error', () => {
	test('502 エラー時に 30 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(502, '502 Bad Gateway', 'Bad Gateway')];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(30_000);
	});

	test('503 エラー時に 30 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [
			createGaxiosError(503, '503 Service Unavailable', 'Service Unavailable'),
		];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(30_000);
	});

	test('500 エラー時に 30 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(500)];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
	});

	test('5xx エラーが連続した場合、成功するまでリトライする', async () => {
		const target = new TestTarget();
		target.errors = [
			createGaxiosError(502),
			createGaxiosError(503),
			createGaxiosError(500),
		];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(4);
		expect(delay).toHaveBeenCalledTimes(3);
	});

	test('5xx エラー時に log コールバックで waiting: true/false が通知される', async () => {
		const target = new TestTargetWithLog();
		target.errors = [createGaxiosError(502, '502 Bad Gateway', 'Bad Gateway')];

		await target.doWork();

		expect(target.logMessages).toHaveLength(2);
		expect(target.logMessages[0]).toEqual(
			expect.objectContaining({
				message: 'ServerError',
				waitTime: 30_000,
				waiting: true,
				code: 502,
			}),
		);
		expect(target.logMessages[1]).toEqual(
			expect.objectContaining({
				message: 'ServerError',
				waitTime: 30_000,
				waiting: false,
				code: 502,
			}),
		);
	});

	test('499 はサーバーエラーとして扱わない', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(499)];

		await expect(target.doWork()).rejects.toThrow();
		expect(target.callCount).toBe(1);
	});

	test('600 はサーバーエラーとして扱わない', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(600)];

		await expect(target.doWork()).rejects.toThrow();
		expect(target.callCount).toBe(1);
	});
});

describe('createErrorHandler - 429 Too Many Requests', () => {
	test('response.status が 429 のとき 110 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(429)];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(110_000);
	});

	test('code が "429" のとき（response なし）もリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosErrorWithCode('429')];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(110_000);
	});

	test('429 エラー時に log コールバックの code にステータスコード数値が渡される', async () => {
		const target = new TestTargetWithLog();
		target.errors = [createGaxiosError(429)];

		await target.doWork();

		expect(target.logMessages[0]).toEqual(
			expect.objectContaining({
				message: 'TooManyRequestError',
				code: 429,
			}),
		);
	});
});

describe('createErrorHandler - 403 User Rate Limit Exceeded', () => {
	test('response.status が 403 かつ "User rate limit exceeded" メッセージのとき 60 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(403, 'User rate limit exceeded')];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(60_000);
	});

	test('403 だが "User rate limit exceeded" を含まないメッセージのときはリトライしない', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(403, 'Forbidden')];

		await expect(target.doWork()).rejects.toThrow();
		expect(target.callCount).toBe(1);
	});
});

describe('createErrorHandler - ECONNRESET', () => {
	test('ECONNRESET エラー時に 5 秒待機してリトライする', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosErrorWithCode('ECONNRESET')];

		const result = await target.doWork();

		expect(result).toBe('success');
		expect(target.callCount).toBe(2);
		expect(delay).toHaveBeenCalledWith(5000);
	});
});

/**
 * 複数のメソッドに別々のハンドラを持つテストクラス。
 * メソッド間のリトライカウント独立性を検証する。
 */
class TestTargetMultiMethod {
	/** methodA が呼ばれた回数。 */
	callCountA = 0;

	/** methodB が呼ばれた回数。 */
	callCountB = 0;

	/** methodA 呼び出し時にスローするエラーのリスト。 */
	errorsA: Error[] = [];

	/** methodB 呼び出し時にスローするエラーのリスト。 */
	errorsB: Error[] = [];

	readonly #handleA = createErrorHandler('methodA');
	readonly #handleB = createErrorHandler('methodB');

	async methodA(): Promise<string> {
		return this.#handleA(() => {
			this.callCountA++;
			const error = this.errorsA.shift();
			if (error) {
				throw error;
			}
			return Promise.resolve('A');
		});
	}

	async methodB(): Promise<string> {
		return this.#handleB(() => {
			this.callCountB++;
			const error = this.errorsB.shift();
			if (error) {
				throw error;
			}
			return Promise.resolve('B');
		});
	}
}

describe('createErrorHandler - 最大リトライ回数', () => {
	test('リトライが 10 回を超えると元の GaxiosError をスローする', async () => {
		const target = new TestTarget();
		target.errors = Array.from({ length: 11 }, () => createGaxiosError(502));

		await expect(target.doWork()).rejects.toThrow(GaxiosError);
		// 初回 + リトライ 10 回 = 11 回呼ばれた後にスロー
		expect(target.callCount).toBe(11);
		expect(delay).toHaveBeenCalledTimes(10);
	});

	test('成功後にリトライカウントがリセットされる', async () => {
		const target = new TestTarget();

		// 1回目の呼び出し: 3回リトライ後に成功
		target.errors = [
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(502),
		];
		const result1 = await target.doWork();
		expect(result1).toBe('success');
		expect(target.callCount).toBe(4);

		// 2回目の呼び出し: 再び 3回リトライ後に成功（カウントがリセットされている）
		target.errors = [
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(502),
		];
		const result2 = await target.doWork();
		expect(result2).toBe('success');
		expect(target.callCount).toBe(8);
	});

	test('異なるメソッドのリトライカウントは独立している', async () => {
		const target = new TestTargetMultiMethod();

		// methodA で 8 回リトライ後に成功（カウント 8/10）
		target.errorsA = Array.from({ length: 8 }, () => createGaxiosError(502));
		const resultA = await target.methodA();
		expect(resultA).toBe('A');
		expect(target.callCountA).toBe(9);

		// methodB で 10 回リトライ後に成功（methodA のカウントに影響されず 10/10 まで可能）
		target.errorsB = Array.from({ length: 10 }, () => createGaxiosError(502));
		const resultB = await target.methodB();
		expect(resultB).toBe('B');
		expect(target.callCountB).toBe(11);
	});

	test('非リトライエラーでスローした後もリトライカウントがリセットされる', async () => {
		const target = new TestTarget();

		// 1回目: 5回リトライ後に 404（非リトライ）でスロー
		target.errors = [
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(502),
			createGaxiosError(404),
		];
		await expect(target.doWork()).rejects.toThrow();

		// 2回目: リトライカウントがリセットされているので 10回までリトライ可能
		target.errors = Array.from({ length: 10 }, () => createGaxiosError(502));
		const result = await target.doWork();
		expect(result).toBe('success');
	});
});

describe('createErrorHandler - 非リトライ対象のエラー', () => {
	test('GaxiosError 以外のエラーはそのままスローされる', async () => {
		const target = new TestTarget();
		target.errors = [new Error('generic error')];

		await expect(target.doWork()).rejects.toThrow('generic error');
		expect(target.callCount).toBe(1);
	});

	test('404 エラーはリトライされない', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(404)];

		await expect(target.doWork()).rejects.toThrow();
		expect(target.callCount).toBe(1);
	});

	test('400 エラーはリトライされない', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(400)];

		await expect(target.doWork()).rejects.toThrow();
		expect(target.callCount).toBe(1);
	});
});

describe('createErrorHandler - ログ文言の配線', () => {
	test('Max retries 超過時のログに methodName が含まれる', async () => {
		const target = new TestTarget();
		target.errors = Array.from({ length: 11 }, () => createGaxiosError(502));

		await expect(target.doWork()).rejects.toThrow();

		expect(errorLogMock).toHaveBeenCalledWith(
			expect.stringContaining('Max retries (10) exceeded in doWork()'),
		);
	});

	test('非リトライエラー時のログに methodName が含まれる', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(404)];

		await expect(target.doWork()).rejects.toThrow();

		expect(errorLogMock).toHaveBeenCalledWith('Caught in: doWork()');
	});

	test('methodName にクラス名修飾子を含むと完全修飾名でログされる', async () => {
		const handle = createErrorHandler('Foo.bar');

		await expect(
			handle(() => {
				throw createGaxiosError(404);
			}),
		).rejects.toThrow();

		expect(errorLogMock).toHaveBeenCalledWith('Caught in: Foo.bar()');
	});

	test('options.log 未指定時はリトライ時に gaxiosErrorLog で wording が出力される', async () => {
		const target = new TestTarget();
		target.errors = [createGaxiosError(502, '502 Bad Gateway', 'Bad Gateway')];

		await target.doWork();

		expect(gaxiosErrorLogMock).toHaveBeenCalledWith(
			expect.stringContaining(
				'ServerError(502): Waiting 30000ms for Bad Gateway (retry 1/10)',
			),
		);
		expect(gaxiosErrorLogMock).toHaveBeenCalledWith(
			expect.stringContaining('ServerError(502): Resumed after 30000ms'),
		);
	});
});

describe('createErrorHandler - Excel ヒントの多重連結ガード', () => {
	test('リトライを跨いで同一 GaxiosError インスタンスが再スローされても Excel ヒントは 1 回のみ追記される', async () => {
		const sharedError = createGaxiosError(
			502,
			'This operation is not supported for this document',
			'Bad Gateway',
		);
		const target = new TestTarget();
		// 同じインスタンスを 3 回連続でスロー → 4 回目で成功 (502 はリトライ対象)
		target.errors = [sharedError, sharedError, sharedError];

		await target.doWork();

		const hintOccurrences = (sharedError.message.match(/⚠️ Hint:/g) ?? []).length;
		expect(hintOccurrences).toBe(1);
	});

	test('別の呼び出し越しに同じインスタンスを再投入しても Excel ヒントは追記済みなら冪等', async () => {
		const error = createGaxiosError(
			404,
			'This operation is not supported for this document',
			'Not Found',
		);
		const target = new TestTarget();
		target.errors = [error];

		await expect(target.doWork()).rejects.toThrow();
		expect((error.message.match(/⚠️ Hint:/g) ?? []).length).toBe(1);

		// 二度目: 同じインスタンスをもう一度通しても重複追加されない
		target.errors = [error];
		await expect(target.doWork()).rejects.toThrow();
		expect((error.message.match(/⚠️ Hint:/g) ?? []).length).toBe(1);
	});
});

describe('createErrorHandler - 並列呼び出しの retryCount 独立性', () => {
	test('同一ハンドラへの並列呼び出しで retryCount は独立し、合計失敗回数が MAX_RETRIES を超えても両方成功できる', async () => {
		const handle = createErrorHandler('parallel');

		let countA = 0;
		let countB = 0;
		const FAILURES = 7;

		const promiseA = handle(() => {
			countA++;
			if (countA <= FAILURES) {
				return Promise.reject(createGaxiosError(502));
			}
			return Promise.resolve('A done');
		});
		const promiseB = handle(() => {
			countB++;
			if (countB <= FAILURES) {
				return Promise.reject(createGaxiosError(502));
			}
			return Promise.resolve('B done');
		});

		const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

		// retryCount が共有されていれば、A+B = 14 回の失敗が積み上がり MAX_RETRIES (10) を超えて
		// 両方または片方が Max retries exceeded で reject されるはず。独立していれば両方成功する。
		expect(resultA).toBe('A done');
		expect(resultB).toBe('B done');
		expect(countA).toBe(FAILURES + 1);
		expect(countB).toBe(FAILURES + 1);
	});
});
