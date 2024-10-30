import { test, expect } from 'vitest';

import { scNumberComparator } from './sc-number-comparator.js';

test('scNumberComparator', () => {
	expect(
		[
			//
			'1.2.3',
			'1.1.1',
			'1.2.1',
			'1.1.2',
			null,
			'1.1.3',
		].toSorted(scNumberComparator),
	).toStrictEqual([
		//
		'1.1.1',
		'1.1.2',
		'1.1.3',
		'1.2.1',
		'1.2.3',
		null,
	]);
});
