import { describe, expect, it } from 'vitest';

import { parseViewportSpec } from './parse-viewport-spec.js';

describe('parseViewportSpec', () => {
	it('parses a name:width pair', () => {
		expect(parseViewportSpec('pc:1280')).toEqual({ name: 'pc', width: 1280 });
	});

	it('throws when there is no colon separator', () => {
		expect(() => parseViewportSpec('pc1280')).toThrow(/expected "name:width"/);
	});

	it('throws when the name is empty', () => {
		expect(() => parseViewportSpec(':1280')).toThrow(/name must not be empty/);
	});

	it('throws when the width is not numeric', () => {
		expect(() => parseViewportSpec('pc:wide')).toThrow(/positive number/);
	});

	it('throws when the width is zero or negative', () => {
		expect(() => parseViewportSpec('pc:0')).toThrow(/positive number/);
		expect(() => parseViewportSpec('pc:-100')).toThrow(/positive number/);
	});
});
