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
	// webpack CSS Modules' default `[name]_[local]__[hash]` convention, e.g.
	// `Layout_root__f3k9d`, `Header_title__3xJ9k`. Anchored on the trailing
	// `__` (exactly two underscores, not one) rather than the whole string,
	// since here the hash is a suffix of an otherwise-meaningful name.
	// Deliberately does NOT also match a single underscore: real-world class
	// names commonly use one underscore as a general-purpose separator
	// followed by a short alphanumeric variant suffix that is not a hash at
	// all — e.g. Divi Builder's `et_pb_gutters3` (gutter-width setting 3 of
	// 8), or hypothetical `grid_col12`/`row_span24`. Matching those against
	// this pattern with only one underscore required turned them into false
	// positives (confirmed via the production-scale fixture corpus); double
	// underscore is a much rarer, more specifically BEM/CSS-Modules-coded
	// convention, so it's a safer anchor. This does mean single-underscore
	// hash suffixes (e.g. HubSpot's `hsForm_9f8e7d6c`) are not caught — an
	// accepted gap, since under-filtering a rare pattern is safer than
	// over-filtering common ones. Requiring both a letter and a digit in the
	// suffix (case-insensitive: real generators mix case, e.g. `q7Rp1`)
	// keeps genuine short BEM-ish element names ending in one digit and
	// nothing else (`col2`, 4 chars) below the 5-char floor from matching;
	// residual risk of a real element name coincidentally looking like a
	// 5-8 char mixed hash right after `__` (e.g. `__col12`) is accepted,
	// same trade-off as the generic pattern above.
	/__(?=[a-z0-9]{5,8}$)(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{5,8}$/i,
];
