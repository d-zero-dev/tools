import { describe, expect, test } from 'vitest';

import { isNoiseClass } from './is-noise-class.js';
import { DEFAULT_NOISE_CLASS_PATTERNS } from './noise-class-patterns.js';

describe('isNoiseClass', () => {
	test.each([
		['_a1b2c3', true],
		['sc-bdVaJa', true],
		['css-1x2y3z', true],
		['chunk-a3f9c1', true],
		['k3j9zq2a', true],
		['card', false],
		['card--active', false],
		['footer', false],
		['current', false],
		// Real CamelCase/mixed-case words that happen to end in a digit must
		// not be caught by the generic alphanumeric-hash pattern, which is
		// deliberately case-sensitive (lowercase-only) for this reason.
		['Section1', false],
		['Banner99', false],
		// BEM: block__element--modifier must survive noise filtering — none
		// of the hash patterns match strings containing `_`/`--` this way.
		['card__title--large', false],
		['nav__list-item--is-current', false],
		// No-code builders (e.g. STUDIO) emit bundler-style content-hash
		// suffixes on generated classes; these are exactly what the
		// "bundler content-hash suffix" pattern targets.
		['s-1a2b3c4d', true],
		// Tailwind's arbitrary-value syntax embeds raw `[`/`]`, which no
		// noise pattern matches (none of them allow those characters), so
		// it must be preserved rather than treated as an auto-generated hash.
		['w-[137px]', false],
		// webpack CSS Modules' default `[name]_[local]__[hash]` convention —
		// discovered via the 200-fixture production-scale sweep, where 122
		// distinct classes across multiple frameworks followed this shape
		// without being caught by any pre-existing pattern.
		['Layout_root__f3k9d', true],
		['Header_title__3xJ9k', true],
		// Single-underscore hash suffixes (e.g. HubSpot's convention) are a
		// known, accepted gap — see noise-class-patterns.ts for why matching
		// on one underscore caused false positives on real single-underscore
		// class names instead.
		['hsForm_9f8e7d6c', false],
		// Short BEM-ish element names immediately after `__` must not be
		// caught just for coincidentally being alphanumeric: below the 5-char floor.
		['menu__list', false],
		['grid__col2', false],
		// Real single-underscore class names with a short alphanumeric variant
		// suffix (not a hash) must survive — this is exactly what broke when
		// the pattern also matched a single underscore (found via the
		// production-scale fixture corpus: Divi Builder's actual gutter-width
		// utility class).
		['et_pb_gutters3', false],
		['grid_col12', false],
		['row_span24', false],
		['tab_index1a', false],
		['avatar_size32', false],
	])('%s -> %s', (className, expected) => {
		expect(isNoiseClass(className, DEFAULT_NOISE_CLASS_PATTERNS)).toBe(expected);
	});
});
