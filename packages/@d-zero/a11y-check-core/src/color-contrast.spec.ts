import { test, expect } from 'vitest';

import { colorContrastCheck, ColorContrastError } from './color-contrast.js';

test('#000 vs #FFF', () => {
	expect(
		colorContrastCheck({
			color: 'rgb(0, 0, 0)',
			backgroundColor: 'rgb(255, 255, 255)',
			backgroundImage: '',
			closestBackgroundColor: null,
			closestBackgroundImage: null,
		}),
	).toStrictEqual({
		foreground: {
			a: 1,
			b: 0,
			g: 0,
			hex: '#000000',
			hexA: '#000000FF',
			r: 0,
		},
		background: {
			a: 1,
			b: 255,
			g: 255,
			hex: '#FFFFFF',
			hexA: '#FFFFFFFF',
			r: 255,
		},
		ratio: 21,
		ratioText: '21:1',
		AA: true,
		AAA: true,
	});
});

test('has alpha channel', () => {
	expect(
		colorContrastCheck({
			color: 'rgba(0, 0, 0, 0.5)',
			backgroundColor: 'rgb(255, 255, 255)',
			backgroundImage: '',
			closestBackgroundColor: null,
			closestBackgroundImage: null,
		}),
	).toBe(ColorContrastError.FOREGROUND_COLOR_HAS_ALPHA);
});
