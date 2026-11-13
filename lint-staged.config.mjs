import lintStagedConfigGenerator from '@d-zero/lint-staged-config';

/**
 * Subset of `@d-zero/lint-staged-config`'s default mapping (oxlint / oxfmt based)
 * for the extensions used in this repository. `defaultMapping` is not exported from
 * the package entry, so a local subset is kept here. cspell and markuplint are not used.
 *
 * The oxlint run here has no type information: type-aware rules
 * (`no-floating-promises` etc.) are first reported by `yarn lint:check` in CI.
 */
const mapping = {
	cjs: ['oxlint', 'oxfmt'],
	css: ['oxfmt'],
	cts: ['oxlint', 'oxfmt'],
	html: ['oxfmt'],
	js: ['oxlint', 'oxfmt'],
	json: ['oxfmt'],
	jsx: ['oxlint', 'oxfmt'],
	md: ['oxfmt', 'textlint'],
	mdc: ['oxfmt', 'textlint'],
	mjs: ['oxlint', 'oxfmt'],
	mts: ['oxlint', 'oxfmt'],
	ts: ['oxlint', 'oxfmt'],
	tsx: ['oxlint', 'oxfmt'],
	yaml: ['oxfmt'],
	yml: ['oxfmt'],
};

export default lintStagedConfigGenerator(
	{
		ignore: [
			{
				textlint: 'CHANGELOG.md',
			},
			{
				// `<body>`-only fragments used as getBoundingClientRect-shim input for
				// anatomist's classify-layer tests: reformatting them changes test results.
				oxfmt: 'packages/@d-zero/anatomist/src/__fixtures__/*.html',
			},
		],
	},
	mapping,
);
