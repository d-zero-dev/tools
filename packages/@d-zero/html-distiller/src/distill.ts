import type { ResultTree } from './types.js';

import { minify } from 'html-minifier-terser';
import { parse } from 'parse5';
import { format } from 'prettier';

import { serialize } from './serialize.js';

/**
 *
 * @param html
 */
export async function distill(html: string): Promise<ResultTree> {
	const minified = await minify(html, {
		collapseWhitespace: true,
		decodeEntities: true,
		minifyCSS: false,
		minifyJS: false,
		quoteCharacter: '"',
		removeComments: false,
		removeEmptyAttributes: true,
		removeEmptyElements: false,
		removeOptionalTags: false,
		removeRedundantAttributes: true,
		removeScriptTypeAttributes: true,
		removeStyleLinkTypeAttributes: true,
		removeTagWhitespace: true,
		sortAttributes: true,
		sortClassName: true,
	});
	const formatted = await format(minified, {
		parser: 'html',
		useTabs: true,
		printWidth: 100_000,
	});
	const ast = parse(formatted);
	const tree = serialize(ast);
	return {
		tree,
	};
}
