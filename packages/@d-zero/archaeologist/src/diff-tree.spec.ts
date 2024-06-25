import { test, expect } from 'vitest';

import { diffTree } from './diff-tree';

test('diffTree', () => {
	expect(
		diffTree(
			'/a/',
			'/b/',
			`
abc
def
ghi
`,
			`
abc
xyz
ghi
`,
		).result,
	).toEqual(
		`===================================================================
--- /a/
+++ /b/
@@ -1,4 +1,4 @@
 
 abc
-def
+xyz
 ghi
`,
	);
});
