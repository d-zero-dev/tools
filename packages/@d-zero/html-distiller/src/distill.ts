import type { ResultTree } from './types.js';

import { parse } from 'parse5';

import { serialize } from './serialize.js';

export function distill(html: string): ResultTree {
	const ast = parse(html);
	const tree = serialize(ast);
	return {
		tree,
	};
}
