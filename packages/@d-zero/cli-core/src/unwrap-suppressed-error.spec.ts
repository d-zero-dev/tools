import { describe, test, expect } from 'vitest';

import { unwrapSuppressedError } from './unwrap-suppressed-error.js';

describe('unwrapSuppressedError', () => {
	test('returns a non-SuppressedError as a single-element array', () => {
		const error = new Error('plain');

		expect(unwrapSuppressedError(error)).toEqual([error]);
	});

	test('returns non-Error values (string, null) untouched', () => {
		expect(unwrapSuppressedError('string error')).toEqual(['string error']);
		expect(unwrapSuppressedError(null)).toEqual([null]);
	});

	test('flattens a SuppressedError into [error, suppressed]', () => {
		const body = new Error('body failure');
		const dispose = new Error('dispose failure');
		const suppressed = new SuppressedError(
			dispose,
			body,
			'An error was suppressed during disposal.',
		);

		// SuppressedError(error, suppressed): `error` が後発（dispose 側）、
		// `suppressed` が先発（本体側）
		expect(unwrapSuppressedError(suppressed)).toEqual([dispose, body]);
	});

	test('recursively flattens nested SuppressedError (multiple disposals failing)', () => {
		const body = new Error('body failure');
		const dispose1 = new Error('dispose failure 1');
		const dispose2 = new Error('dispose failure 2');
		const inner = new SuppressedError(
			dispose1,
			body,
			'An error was suppressed during disposal.',
		);
		const outer = new SuppressedError(
			dispose2,
			inner,
			'An error was suppressed during disposal.',
		);

		expect(unwrapSuppressedError(outer)).toEqual([dispose2, dispose1, body]);
	});
});
