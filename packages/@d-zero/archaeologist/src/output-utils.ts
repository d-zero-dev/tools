import c from 'ansi-colors';

export function label(str: string, color = c.bgMagenta) {
	return color(` ${str} `);
}

export function score(matches: number, threshold: number) {
	const color = matches > threshold ? c.green : c.red;
	const num = (matches * 100).toFixed(1);
	return c.bold(color(`${num}%`));
}
