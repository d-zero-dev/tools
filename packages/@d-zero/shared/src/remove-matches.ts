export function removeMatches(t1: string, t2: string): [string, string] {
	let loopCount = Math.max(t1.length, t2.length);
	t1 = t1.toLowerCase();
	t2 = t2.toLowerCase();
	const a1 = [...t1];
	const a2 = [...t2];
	while (loopCount--) {
		if (a1[0] !== a2[0]) {
			return [a1.join(''), a2.join('')];
		}
		a1.shift();
		a2.shift();
	}

	return ['', ''];
}
