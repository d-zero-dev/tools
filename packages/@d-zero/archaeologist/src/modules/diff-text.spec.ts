import { test, expect } from 'vitest';

import { diffText } from './diff-text.js';

test('diffText', () => {
	expect(diffText('/a/', '/b/', '本日は晴天なり', '本日は雨天なり').result)
		.toEqual(`===================================================================
--- /a/
+++ /b/
@@ -1,4 +1,4 @@
 なり:助動詞:* x1
 は:助詞:係助詞 x1
-晴天:名詞:一般 x1
+雨天:名詞:一般 x1
 本日:名詞:副詞可能 x1
\\ No newline at end of file
`);
});
