/**
 *
 * @param t1
 * @param t2
 */
export function removeMatches(t1: string, t2: string): [string, string] {
	let loopCount = Math.max(t1.length, t2.length);
	t1 = t1.toLowerCase();
	t2 = t2.toLowerCase();
	/* oxlint-disable typescript/no-misused-spread -- Compares one code point at a time on purpose: splitting by UTF-16 unit would break surrogate pairs, and grapheme segmentation would change which prefix counts as matching. */
	const a1 = [...t1];
	const a2 = [...t2];
	/* oxlint-enable typescript/no-misused-spread */
	while (loopCount--) {
		if (a1[0] !== a2[0]) {
			return [a1.join(''), a2.join('')];
		}
		a1.shift();
		a2.shift();
	}

	return ['', ''];
}
