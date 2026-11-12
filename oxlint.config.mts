import config from '@d-zero/oxlint-config';

/**
 * Lint is oxlint-native only. Rules that `@d-zero/eslint-config` enforced and that are
 * intentionally absent now, so they are review-only conventions:
 * - `no-restricted-syntax`: `#private` instead of `private`, no `public` keyword,
 *   `_`-prefixed methods are `protected` and only those, no `DOMContentLoaded`
 *   listener
 * - `import-x/*` (import order, no-extraneous-dependencies), `sort-class-members`,
 *   `eslint-plugin-regexp`, `eslint-plugin-eslint-comments`
 * - the `jsdoc` check rules (e.g. `check-param-names`); only the `require-*` and a few
 *   `check-*` rules of `@d-zero/oxlint-config` apply
 * - the `unicorn` rules that oxlint does not implement
 * - `typescript/no-namespace` no longer allows `declare namespace`
 *
 * Type-aware rules read each package's built `dist/*.d.ts`, so run `yarn build`
 * before `yarn lint`. Without the build output, `@d-zero/*` types collapse to `any`.
 *
 * `@d-zero/oxlint-plugin` is not used: its only rule (`@d-zero/no-click-event`)
 * targets click handlers, which this repository has none of.
 */
export default {
	...config,
	rules: {
		...config.rules,
		// The types live in TypeScript; do not make JSDoc restate them.
		'jsdoc/require-param-type': 'off',
		'jsdoc/require-param-description': 'off',
		'jsdoc/require-returns': 'off',
		'jsdoc/require-returns-type': 'off',
		'jsdoc/require-returns-description': 'off',
		// oxfmt always lowercases hex digits, so this rule (which wants uppercase) could
		// only ever disagree with the formatter.
		'unicorn/number-literal-case': 'off',
		// `@d-zero/eslint-config` enforced this as an error; `@d-zero/oxlint-config` does
		// not enable it, so it is kept here.
		'typescript/no-floating-promises': 'error',
	},
	ignorePatterns: [
		...config.ignorePatterns,
		// `@d-zero/oxlint-config` ignores `lib`; the packages here emit `dist`.
		'**/dist/**',
		// Nested git worktrees of other sessions hold full copies of the repository.
		'.claude/worktrees/**',
	],
	overrides: [
		{
			// `.textlintrc.js` is CommonJS (the same rules the old `commonjs` config relaxed).
			files: ['.textlintrc.js'],
			rules: {
				'typescript/no-require-imports': 'off',
				'typescript/no-var-requires': 'off',
				'unicorn/prefer-module': 'off',
			},
		},
		{
			// These specs reference mocked methods as values (`expect(fake.close)`),
			// which `unbound-method` forbids. Listed per file so that every other spec
			// still gets the rule.
			files: [
				'packages/@d-zero/beholder/src/measure-scroll-height.spec.ts',
				'packages/@d-zero/proc-talk/src/proc-talk.spec.ts',
				'packages/@d-zero/puppeteer-page-scan/src/before-page-scan.spec.ts',
				'packages/@d-zero/remote-inspector/src/output.spec.ts',
			],
			rules: {
				'typescript/unbound-method': 'off',
			},
		},
		{
			// Demos, manual test scripts and maintenance scripts are CLI tools: stdout is
			// their interface.
			files: [
				'packages/@d-zero/dealer/demo/**',
				'packages/@d-zero/*/test/**',
				'.claude/skills/*/scripts/**',
			],
			rules: {
				'no-console': 'off',
			},
		},
		{
			// Hook fixtures are the input of the loader's tests: their signature (async
			// functions without `await`) is part of what is being loaded, so it is not
			// rewritten to satisfy `require-await`.
			files: ['packages/@d-zero/puppeteer-page-scan/src/__fixtures__/**'],
			rules: {
				'typescript/require-await': 'off',
			},
		},
	],
};
