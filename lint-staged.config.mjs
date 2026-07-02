import lintStagedConfigGenerator from '@d-zero/lint-staged-config';
export default lintStagedConfigGenerator({
	ignore: [
		{
			textlint: 'CHANGELOG.md',
		},
		{
			// These are minimal <body>-only fragments for the page-cluster
			// tokenizer's tests, not deployable pages, so markuplint's
			// full-document validity rules (doctype, <html>, <head>, ...) don't
			// apply to them.
			markuplint: 'packages/@d-zero/page-cluster/src/__fixtures__/*.html',
		},
	],
});
