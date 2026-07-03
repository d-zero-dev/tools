import lintStagedConfigGenerator from '@d-zero/lint-staged-config';
export default lintStagedConfigGenerator({
	ignore: [
		{
			textlint: 'CHANGELOG.md',
		},
		{
			// Synthetic fixtures for the page-cluster tokenizer's tests
			// (including 200 production-scale ones nested in subdirectories,
			// hence `**` — a non-recursive glob here previously let files
			// under `production-scale/*/` slip through to markuplint, which
			// isn't installed in this repo and would fail the commit).
			// Several are intentionally malformed (adversarial-scale/) or
			// minimal <body>-only fragments, so markuplint's full-document
			// validity rules don't apply to any of them.
			markuplint: 'packages/@d-zero/page-cluster/src/__fixtures__/**/*.html',
			// Same directory, different tool: prettier's HTML parser throws a
			// hard SyntaxError (not just a lint warning) on the
			// adversarial-scale/ fixtures' deliberately malformed markup
			// (mismatched closing tags, invalid entities, ...) — exactly the
			// leniency htmlparser2 is supposed to be tested against.
			prettier: 'packages/@d-zero/page-cluster/src/__fixtures__/**/*.html',
		},
	],
});
