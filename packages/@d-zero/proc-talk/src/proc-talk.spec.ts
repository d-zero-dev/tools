import type * as childProcessModule from 'node:child_process';

import { ChildProcess, fork } from 'node:child_process';

import { describe, test, expect, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof childProcessModule>();
	return {
		...actual,
		fork: vi.fn(),
	};
});

import { ProcTalk } from './proc-talk.js';

/**
 * `fork()` が実プロセスを起動せずに返す `ChildProcess` の代役を作る。
 * `send` はプロトタイプに実装がない（実際の IPC チャネルがないため）ので
 * テスト用にスタブを生やす。
 * @param options - 代役の初期状態
 * @param options.connected - IPC チャネルが開いているか（デフォルト: true）
 */
function createFakeChildProcess(options: { connected?: boolean } = {}): ChildProcess {
	const cp = new ChildProcess();
	// @ts-expect-error -- test stub: 実際の spawn を経ていないため connected は読み取り専用でない
	cp.connected = options.connected ?? true;
	// @ts-expect-error -- test stub: 実際の spawn を経ていないため send が無い
	cp.send = vi.fn(() => true);
	// @ts-expect-error -- test stub
	cp.kill = vi.fn();
	return cp;
}

describe('ProcTalk.close() idempotency', () => {
	test('two concurrent calls return the same promise and send :kill only once', async () => {
		const cp = createFakeChildProcess();
		vi.mocked(fork).mockReturnValue(cp);

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		const close1 = talk.close();
		const close2 = talk.close();

		expect(close1).toBe(close2);

		cp.emit('exit', 0, null);

		await expect(close1).resolves.toBeUndefined();
		await expect(close2).resolves.toBeUndefined();
		expect(cp.send).toHaveBeenCalledTimes(1);
	});

	test('close() on an already-exited process resolves immediately without hanging', async () => {
		const cp = createFakeChildProcess();
		vi.mocked(fork).mockReturnValue(cp);
		cp.exitCode = 0;

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		// 事前に exitCode が設定済み（=既に exit 済み）の場合、
		// once('exit', ...) を張ると二度と発火せず永久 pending になっていた回帰を防ぐ
		await expect(talk.close()).resolves.toBeUndefined();
	});

	test('[Symbol.asyncDispose] delegates to the same idempotent close logic', async () => {
		const cp = createFakeChildProcess();
		vi.mocked(fork).mockReturnValue(cp);

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		const disposePromise = talk[Symbol.asyncDispose]();
		cp.emit('exit', 0, null);
		await disposePromise;

		await expect(talk.close()).resolves.toBeUndefined();
		expect(cp.send).toHaveBeenCalledTimes(1);
	});
});

describe('ProcTalk.close() channel/fallback handling', () => {
	test('closed IPC channel (connected=false) falls back to kill() without sending', async () => {
		const cp = createFakeChildProcess({ connected: false });
		vi.mocked(fork).mockReturnValue(cp);

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		const closePromise = talk.close();

		// :kill は届かないので send せず直接シグナルで止める
		expect(cp.send).not.toHaveBeenCalled();
		expect(cp.kill).toHaveBeenCalledTimes(1);

		cp.emit('exit', null, 'SIGTERM');
		await expect(closePromise).resolves.toBeUndefined();
	});

	test('send() delivery failure (callback error) falls back to kill() instead of crashing', async () => {
		const cp = createFakeChildProcess();
		// send のコールバックにエラーを渡す = ERR_IPC_CHANNEL_CLOSED 相当。
		// コールバック形式なら 'error' イベントは emit されず、ここで捕捉できる
		// @ts-expect-error -- test stub
		cp.send = vi.fn((_msg: unknown, callback: (error: Error | null) => void) => {
			callback(new Error('ERR_IPC_CHANNEL_CLOSED'));
			return false;
		});
		vi.mocked(fork).mockReturnValue(cp);

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		const closePromise = talk.close();

		expect(cp.kill).toHaveBeenCalledTimes(1);

		cp.emit('exit', null, 'SIGTERM');
		await expect(closePromise).resolves.toBeUndefined();
	});

	test('send() returning false with successful delivery (backpressure) does NOT kill', async () => {
		const cp = createFakeChildProcess();
		// バックプレッシャ: 戻り値は false だがメッセージ自体はキューされ、
		// コールバックはエラーなしで呼ばれる — この場合 SIGTERM を送ってはいけない
		// （graceful cleanup（Chromium teardown 等）がスキップされてしまう）
		// @ts-expect-error -- test stub
		cp.send = vi.fn((_msg: unknown, callback: (error: Error | null) => void) => {
			callback(null);
			return false;
		});
		vi.mocked(fork).mockReturnValue(cp);

		const talk = new ProcTalk({ type: 'main', subModulePath: '/dummy.js' });

		const closePromise = talk.close();

		expect(cp.kill).not.toHaveBeenCalled();

		cp.emit('exit', 0, null);
		await expect(closePromise).resolves.toBeUndefined();
	});
});
