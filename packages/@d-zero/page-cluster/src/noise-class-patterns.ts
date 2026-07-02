/**
 * Heuristics for auto-generated class names that change on every build even
 * when the underlying template is unchanged (CSS Modules, styled-components,
 * emotion, bundler content-hash suffixes). Left in place, these would make
 * identical templates look structurally different across builds/deploys,
 * defeating near-duplicate detection. The generic alphanumeric-hash pattern requires
 * both a letter and a digit so real words (e.g. BEM modifiers like
 * `card--active`) are not caught by accident; it is still the least precise
 * entry here, which is why `filterNoiseClasses` can be turned off.
 */
export const DEFAULT_NOISE_CLASS_PATTERNS: readonly RegExp[] = [
	// CSS Modules bare hash suffix, e.g. `_a1b2c3`
	/^_[a-z0-9]{5,}$/i,
	// styled-components, e.g. `sc-bdVaJa`
	/^sc-[a-zA-Z0-9]{5,}$/,
	// emotion, e.g. `css-1x2y3z`
	/^css-[a-z0-9]{5,8}$/i,
	// bundler content-hash suffix, e.g. `chunk-a3f9c1`
	/^[a-z]+-[a-f0-9]{6,8}$/i,
	// generic alphanumeric hash, e.g. `k3j9zq2a` (must mix letters and digits).
	// Deliberately case-sensitive (no `i` flag): auto-generated hash tokens are
	// conventionally all-lowercase, and real CamelCase/mixed-case class names
	// that happen to end in a digit (e.g. `Section1`, `Banner99`) must not be
	// caught by this — the whole point of requiring both a letter and a digit.
	/^(?=.*[a-z])(?=.*\d)[a-z0-9]{6,10}$/,
];
