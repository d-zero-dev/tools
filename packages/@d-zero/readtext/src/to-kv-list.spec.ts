import { describe, test, expect } from 'vitest';

import { toKvList } from './to-kv-list.js';

describe('toKvList', () => {
	test('', () => {
		expect(
			toKvList(`
key1 Value1
# Comment
key2 Value2

Value3
key4 Value4 some extra text

`),
		).toStrictEqual([
			{ key: 'key1', value: 'Value1' },
			{ key: 'key2', value: 'Value2' },
			{ key: 'Value3', value: '' },
			{ key: 'key4', value: 'Value4 some extra text' },
		]);
	});
});
