import type { ErrorHandlerOptions } from './error-handler.js';

import { delay } from '@d-zero/shared/delay';
import { GaxiosError } from 'gaxios';
import { describe, test, expect, vi, beforeEach } from 'vitest';

import { ErrorHandler } from './error-handler.js';

vi.mock('@d-zero/shared/delay', () => ({
	delay: vi.fn().mockResolvedValue(),
}));

vi.mock('../debug.js', () => {
	const noop = () => {};
	noop.extend = () => noop;
	return { log: noop };
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
 * ErrorHandler デコレータをテストするためのテストクラス。
 */
class TestTarget {
	/** メソッドが呼ばれた回数。 */
	callCount = 0;

	/** 呼び出し時にスローするエラーのリスト。空になると成功を返す。 */
	errors: Error[] = [];

	/**
	 * テスト対象メソッド。
	 */
	@ErrorHandler()
	// eslint-disable-next-line @typescript-eslint/require-await
	async doWork(): Promise<string> {
		this.callCount++;
		const error = this.errors.shift();
		if (error) {
			throw error;
		}
		return 'success';
	}
}

/**
 * ErrorHandler デコレータを log オプション付きでテストするクラス。
 */
class TestTargetWithLog {
	/** メソッドが呼ばれた回数。 */
	callCount = 0;

	/** 呼び出し時にスローするエラーのリスト。 */
	errors: Error[] = [];

	/** log コールバックで受け取ったメッセージ。 */
	logMessages: Parameters<ErrorHandlerOptions<TestTargetWithLog>['log']>[0][] = [];

	/**
	 * テスト対象メソッド。
	 */
	@ErrorHandler<TestTargetWithLog>({
		log(message) {
			this.logMessages.push(message);
		},
	})
	// eslint-disable-next-line @typescript-eslint/require-await
	async doWork(): Promise<string> {
		this.callCount++;
		const error = this.errors.shift();
		if (error) {
			throw error;
		}
		return 'success';
	}
}

beforeEach(() => {
	vi.mocked(delay).mockReset();
	vi.mocked(delay).mockResolvedValue();
});

describe('ErrorHandler - 5xx Server Error', () => {
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

describe('ErrorHandler - 429 Too Many Requests', () => {
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

describe('ErrorHandler - 403 User Rate Limit Exceeded', () => {
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

describe('ErrorHandler - ECONNRESET', () => {
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
 * 複数のデコレート済みメソッドを持つテストクラス。
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

	/**
	 * テスト対象メソッド A。
	 */
	@ErrorHandler()
	// eslint-disable-next-line @typescript-eslint/require-await
	async methodA(): Promise<string> {
		this.callCountA++;
		const error = this.errorsA.shift();
		if (error) {
			throw error;
		}
		return 'A';
	}

	/**
	 * テスト対象メソッド B。
	 */
	@ErrorHandler()
	// eslint-disable-next-line @typescript-eslint/require-await
	async methodB(): Promise<string> {
		this.callCountB++;
		const error = this.errorsB.shift();
		if (error) {
			throw error;
		}
		return 'B';
	}
}

describe('ErrorHandler - 最大リトライ回数', () => {
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

describe('ErrorHandler - 非リトライ対象のエラー', () => {
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
