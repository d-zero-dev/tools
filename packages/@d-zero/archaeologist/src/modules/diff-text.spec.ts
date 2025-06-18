import { test, expect } from 'vitest';

import { diffText } from './diff-text.js';

test('diffText', () => {
	const result = diffText('/a/', '/b/', '本日は晴天なり', '本日は雨天なり').tokens.result;

	// Check that the result contains the expected elements
	expect(result).toContain('--- /a/');
	expect(result).toContain('+++ /b/');
	expect(result).toContain('-晴天:名詞:一般 x1');
	expect(result).toContain('+雨天:名詞:一般 x1');
	expect(result).toContain('なり:助動詞:* x1');
	expect(result).toContain('は:助詞:係助詞 x1');
	expect(result).toContain('本日:名詞:副詞可能 x1');
});
