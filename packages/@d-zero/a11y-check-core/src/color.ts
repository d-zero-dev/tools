import type { Color } from './types.js';

export function colorFnToHex(colorFn: string | null): Color | null {
	if (!colorFn) {
		return null;
	}

	const match = colorFn.match(
		/rgba?\s*\(\s*(?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)(?:\s*,\s*(?<a>\d*(?:\.\d+)?))?\)/,
	);
	if (!match) {
		return null;
	}
	const r = Number.parseInt(match.groups?.r ?? '0');
	const g = Number.parseInt(match.groups?.g ?? '0');
	const b = Number.parseInt(match.groups?.b ?? '0');
	const a = Number.parseFloat(match.groups?.a ?? '1');

	if (a === 0) {
		// Fully transparent
		return null;
	}

	const R = r.toString(16).padStart(2, '0').toUpperCase();
	const G = g.toString(16).padStart(2, '0').toUpperCase();
	const B = b.toString(16).padStart(2, '0').toUpperCase();
	const A = Math.round(a * 255)
		.toString(16)
		.padStart(2, '0')
		.toUpperCase();

	return {
		r,
		g,
		b,
		a,
		hex: `#${R}${G}${B}`,
		hexA: `#${R}${G}${B}${A}`,
	};
}
