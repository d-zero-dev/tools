import { test, expect } from 'vitest';

import { diffTree } from './diff-tree';

test('diffTree', () => {
	expect(
		diffTree(
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
		`
 abc
-def
+xyz
 ghi
`,
	);
});
