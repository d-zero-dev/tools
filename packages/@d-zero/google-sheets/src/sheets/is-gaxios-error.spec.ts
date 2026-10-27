import { GaxiosError } from 'gaxios';
import { describe, test, expect } from 'vitest';

import { isGaxiosError } from './is-gaxios-error.js';

/**
 * 別の版の gaxios が生成した `GaxiosError` を模したエラーを作る。
 *
 * `new GaxiosError()` で作ると同じクラスになり `instanceof` が通ってしまうため、
 * 別の版が付けるシンボルだけを持つ素の `Error` にする。
 * @param version シンボルの値（gaxios の版）
 */
function createForeignGaxiosError(version = '0.0.0-other') {
	const error = new Error('foreign');
	Object.defineProperty(error, Symbol.for('gaxios-gaxios-error'), { value: version });
	return error;
}

describe('isGaxiosError', () => {
	test('目印のシンボルのキーは、インストールされている gaxios の GaxiosError が実際に持つものと一致する', () => {
		const error = new GaxiosError('boom', { url: 'test' });
		expect(Symbol.for('gaxios-gaxios-error') in error).toBe(true);
	});

	test('同じ版の GaxiosError は true', () => {
		expect(isGaxiosError(new GaxiosError('boom', { url: 'test' }))).toBe(true);
	});

	test('このパッケージの GaxiosError の instanceof では false になる別の版のエラーも、シンボルの値（版）によらず true', () => {
		const other = createForeignGaxiosError('0.0.0-other');
		const future = createForeignGaxiosError('999.0.0');
		expect(other instanceof GaxiosError).toBe(false);
		expect(future instanceof GaxiosError).toBe(false);
		expect(isGaxiosError(other)).toBe(true);
		expect(isGaxiosError(future)).toBe(true);
	});

	test('シンボルを持たない素の Error は false', () => {
		expect(isGaxiosError(new Error('plain'))).toBe(false);
	});

	test('Error ではないオブジェクトは、シンボルを持っていても false', () => {
		expect(isGaxiosError({ [Symbol.for('gaxios-gaxios-error')]: '1.0.0' })).toBe(false);
	});

	test.each([null, undefined, 'error', 429, {}])('%o は false', (value) => {
		expect(isGaxiosError(value)).toBe(false);
	});
});
