import type { log } from 'debug';

import { describe, expect, it } from 'vitest';

import { deserialize } from './deserialize.js';
import { serialize } from './serialize.js';

const noopLog = (() => {}) as unknown as typeof log;

describe('serialize / deserialize ラウンドトリップ', () => {
	it('PageHookSource 形状 ({ paths: string[]; baseDir: string }) は JSON+IPC ラウンドトリップで保持される', () => {
		const input = [
			{
				paths: ['./hooks/a.mjs', './hooks/b.cjs'],
				baseDir: '/Users/me/project',
			},
		];

		// proc-talk の send は serialize → JSON 化（process.send 内部）→ JSON parse → deserialize
		// を経由するため、その経路をシミュレートする。
		// structuredClone は関数で DataCloneError を投げる/型を保つため、IPC 挙動の代用にはならない。
		const serialized = serialize(input, noopLog);
		// eslint-disable-next-line unicorn/prefer-structured-clone
		const ipcRound = JSON.parse(JSON.stringify(serialized)) as unknown[];
		const result = deserialize(ipcRound, noopLog);

		expect(result).toEqual(input);
	});

	it('トップレベルの配列要素が関数なら javascript:... に変換され、deserialize で関数として復元される', () => {
		const fn = () => 42;
		const serialized = serialize([fn], noopLog);

		expect(typeof serialized[0]).toBe('string');
		expect((serialized[0] as string).startsWith('javascript:')).toBe(true);

		const restored = deserialize(serialized, noopLog) as Array<() => number>;
		expect(typeof restored[0]).toBe('function');
		expect(restored[0]!()).toBe(42);
	});

	it('回帰防止: オブジェクト内の配列内に置かれた関数は serialize でそのまま素通りし、IPC で null になる', () => {
		// これは print/archaeologist/a11y-check で発生していた事故の原因そのもの。
		// serialize は data.map のトップレベルしか走査しないため、ネスト関数を javascript:... 化しない。
		// その結果、Node IPC の JSON 化で関数は null に置換される。
		// この振る舞いが変わらない限り、PageHookSource パターン（パスで渡す）を維持する必要がある。
		const fn = () => 'hello';
		const serialized = serialize([{ hooks: [fn] }], noopLog);

		expect(typeof (serialized[0] as { hooks: unknown[] }).hooks[0]).toBe('function');

		// process.send 内部の JSON 化相当（structuredClone は関数で DataCloneError なので使えない）
		// eslint-disable-next-line unicorn/prefer-structured-clone
		const ipcRound = JSON.parse(JSON.stringify(serialized)) as Array<{
			hooks: unknown[];
		}>;
		expect(ipcRound[0]!.hooks[0]).toBeNull();
	});

	it('Uint8Array はトップレベル要素なら IPC ラウンドトリップで復元される', () => {
		const input = [new Uint8Array([1, 2, 3, 255])];
		const serialized = serialize(input, noopLog);
		// eslint-disable-next-line unicorn/prefer-structured-clone
		const ipcRound = JSON.parse(JSON.stringify(serialized)) as unknown[];
		const restored = deserialize(ipcRound, noopLog);

		expect(restored[0]).toBeInstanceOf(Uint8Array);
		expect([...(restored[0] as Uint8Array)]).toEqual([1, 2, 3, 255]);
	});

	it('末尾の undefined は除去される', () => {
		const serialized = serialize(['a', 'b', undefined, undefined], noopLog);
		expect(serialized).toEqual(['a', 'b']);
	});
});
