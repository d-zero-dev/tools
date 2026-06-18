import { describe, expect, it, vi } from 'vitest';

import {
	evaluateWithFrameRetry,
	isTransientFrameError,
} from './evaluate-with-frame-retry.js';

describe('isTransientFrameError', () => {
	it('Attempted to use detached Frame は transient と判定する', () => {
		expect(isTransientFrameError(new Error("Attempted to use detached Frame 'X'."))).toBe(
			true,
		);
	});

	it('Session closed は transient と判定する', () => {
		expect(
			isTransientFrameError(
				new Error('Protocol error (Runtime.callFunctionOn): Session closed.'),
			),
		).toBe(true);
	});

	it('Execution context was destroyed は transient と判定する', () => {
		expect(
			isTransientFrameError(
				new Error('Execution context was destroyed during navigation'),
			),
		).toBe(true);
	});

	it('大文字小文字は区別しない (Session)', () => {
		expect(isTransientFrameError(new Error('SESSION CLOSED'))).toBe(true);
	});

	it('大文字小文字は区別しない (detached Frame)', () => {
		expect(isTransientFrameError(new Error('ATTEMPTED TO USE DETACHED FRAME'))).toBe(
			true,
		);
	});

	it('大文字小文字は区別しない (Execution context)', () => {
		expect(isTransientFrameError(new Error('EXECUTION CONTEXT WAS DESTROYED'))).toBe(
			true,
		);
	});

	it('Error 以外のオブジェクトは false', () => {
		expect(isTransientFrameError('detached Frame')).toBe(false);
		expect(isTransientFrameError(null)).toBe(false);
		expect(isTransientFrameError()).toBe(false);
		expect(isTransientFrameError({ message: 'detached Frame' })).toBe(false);
	});

	it('関係ない Error は false', () => {
		expect(isTransientFrameError(new Error('TypeError: foo is not a function'))).toBe(
			false,
		);
	});
});

describe('evaluateWithFrameRetry', () => {
	it('成功時はそのまま resolve する', async () => {
		const evaluator = vi.fn().mockResolvedValue(42);

		await expect(evaluateWithFrameRetry(evaluator)).resolves.toBe(42);
		expect(evaluator).toHaveBeenCalledTimes(1);
	});

	it('transient エラーが 1 回出てもリトライで吸収して resolve する', async () => {
		const evaluator = vi
			.fn()
			.mockRejectedValueOnce(new Error("Attempted to use detached Frame 'X'."))
			.mockResolvedValueOnce(42);

		await expect(evaluateWithFrameRetry(evaluator)).resolves.toBe(42);
		expect(evaluator).toHaveBeenCalledTimes(2);
	});

	it('transient エラーが連続 3 回続くと最後のエラーを throw する', async () => {
		const evaluator = vi
			.fn()
			.mockRejectedValue(new Error("Attempted to use detached Frame 'X'."));

		await expect(evaluateWithFrameRetry(evaluator)).rejects.toThrow(
			"Attempted to use detached Frame 'X'.",
		);
		expect(evaluator).toHaveBeenCalledTimes(3);
	});

	it('非 transient エラーは即座に throw されリトライしない', async () => {
		const evaluator = vi
			.fn()
			.mockRejectedValue(new Error('TypeError: foo is not a function'));

		await expect(evaluateWithFrameRetry(evaluator)).rejects.toThrow('TypeError');
		expect(evaluator).toHaveBeenCalledTimes(1);
	});
});
