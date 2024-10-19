import c from 'ansi-colors';

export function score(matches: number, threshold: number) {
	const color = matches > threshold ? c.green : c.red;
	const num = (matches * 100).toFixed(1);
	return c.bold(color(`${num}%`));
}
