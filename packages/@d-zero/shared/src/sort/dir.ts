import { numericalComparator } from './numerical.js';

/**
 * Compares two directory paths and returns a value indicating their order.
 *
 * @example
 * ```ts
 * import { dirComparator } from '@d-zero/shared/sort/dir';
 *
 * const dirs = [
 * 	['a', 'b', 'c'],
 * 	['a', 'b', 'd'],
 * 	['a', 'b', ''],
 * 	['a', 'b', 'index'],
 * 	['a', 'b', 'index', ''],
 * 	['a', 'b', 'index', 'c'],
 * 	['a', 'b', 'index', 'd'],
 * 	['a', 'b', 'index', '1'],
 * 	['a', 'b', 'index', '2'],
 * 	['a', 'b', 'index', '10'],
 * ];
 *
 * dirs.sort(dirComparator);
 * ```
 *
 * @param d1 - The first directory path to compare.
 * @param d2 - The second directory path to compare.
 * @returns A value of 0 if the directory paths are equal, -1 if d1 should be sorted before d2, or 1 if d1 should be sorted after d2.
 */
export function dirComparator(d1: readonly string[], d2: readonly string[]): 0 | -1 | 1 {
	const _d1 = [...d1];
	const _d2 = [...d2];
	while (Math.max(d1.length, d2.length)) {
		let i1 = _d1.shift();
		let i2 = _d2.shift();
		const isDir1 = _d1[0] != null;
		const isDir2 = _d2[0] != null;
		if (i1 == null && i2 == null) {
			return 0;
		}
		if (i1 == null) {
			return -1;
		}
		if (i2 == null) {
			return 1;
		}
		if (i1 === i2) {
			continue;
		}
		if (i1 === '') {
			return -1;
		}
		if (i2 === '') {
			return 1;
		}
		i1 = i1.toLowerCase();
		i2 = i2.toLowerCase();
		const isIndex1 = i1.startsWith('index') || i1 === '';
		const isIndex2 = i2.startsWith('index') || i2 === '';
		if (!isDir1 && !isDir2 && isIndex1 && isIndex2) {
			return 0;
		}
		if (!isDir1 && isIndex1) {
			return -1;
		}
		if (!isDir2 && isIndex2) {
			return 1;
		}
		const r = numericalComparator(i1, i2);
		if (r) {
			return r;
		}
	}

	return 0;
}
