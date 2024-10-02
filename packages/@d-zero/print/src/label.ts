import c from 'ansi-colors';

export function label(str: string, color = c.bgMagenta) {
	return color(` ${str} `);
}
