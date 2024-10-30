import type { ColorContrast, Style } from './types.js';

// @ts-ignore
import ColorContrastChecker from 'color-contrast-checker';

import { colorFnToHex } from './color.js';

const ccc = new ColorContrastChecker();

export enum ColorContrastError {
	DOES_NOT_DETERMINE_FOREGROUND,
	DOES_NOT_DETERMINE_BACKGROUND,
	FOREGROUND_COLOR_HAS_ALPHA,
	BACKGROUND_COLOR_HAS_ALPHA,
}

export function colorContrastCheck(style: Style): ColorContrastError | ColorContrast {
	const foreground = colorFnToHex(style.color);

	if (!foreground) {
		return ColorContrastError.DOES_NOT_DETERMINE_FOREGROUND;
	}

	if (foreground.a < 1) {
		return ColorContrastError.FOREGROUND_COLOR_HAS_ALPHA;
	}

	const background =
		colorFnToHex(style.backgroundColor) ?? colorFnToHex(style.closestBackgroundColor);

	if (!background) {
		return ColorContrastError.DOES_NOT_DETERMINE_BACKGROUND;
	}

	if (background.a < 1) {
		return ColorContrastError.BACKGROUND_COLOR_HAS_ALPHA;
	}

	const fL = ccc.hexToLuminance(foreground.hex);
	const bL = ccc.hexToLuminance(background.hex);
	const ratio = ccc.getContrastRatio(fL, bL);
	const ratioText: `${number}:1` = `${ratio.toFixed(2).replace(/\.0+$/, '')}:1`;

	const wcag = ccc.verifyContrastRatio(ratio);

	return {
		foreground,
		background,
		ratio,
		ratioText,
		AA: wcag.WCAG_AA,
		AAA: wcag.WCAG_AAA,
	};
}
