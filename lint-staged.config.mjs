import lintStagedConfigGenerator from '@d-zero/lint-staged-config';
export default lintStagedConfigGenerator({
	ignore: [
		{
			textlint: 'CHANGELOG.md',
		},
		{
			// markuplint isn't installed in this repo and would fail the
			// commit. These are `<body>`-only fragments used as
			// getBoundingClientRect-shim input for anatomist's classify-layer
			// tests, not full documents, so markuplint's document-validity
			// rules don't apply to them regardless.
			markuplint: 'packages/@d-zero/anatomist/src/__fixtures__/*.html',
		},
	],
});
