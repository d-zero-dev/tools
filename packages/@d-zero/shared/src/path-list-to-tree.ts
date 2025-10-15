import path from 'node:path';

import { parseUrl } from './parse-url.js';
import { pathComparator } from './sort/path.js';

export type PathListToTreeOptions = {
	currentPath?: string;

	/**
	 *
	 */
	baseUrl?: string;

	/**
	 * Extensions to consider
	 */
	extensions?: string[];

	/**
	 * Ignore paths (glob)
	 */
	ignoreGlobs?: string[];

	/**
	 * Create virtual parent node
	 */
	createVirtualParent?: boolean;

	/**
	 *
	 */
	filter?: (node: Node) => boolean | Promise<boolean>;
};

export type Node = {
	url: string;
	stem: string;
	depth: number;
	current: boolean;
	virtual?: true;
	children: Node[];
};

/**
 *
 * @param pathList
 * @param options
 */
export async function pathListToTree(
	pathList: string[],
	options?: PathListToTreeOptions,
) {
	const sortedList = pathList.toSorted(pathComparator);

	const currentPath = options?.currentPath;
	const baseUrl = options?.baseUrl ?? 'https://example.com';
	const extensions = new Set([
		'.html',
		'.htm',
		...(options?.extensions?.map((extension) => extension.toLowerCase().trim()) ?? []),
	]);
	const ignoreGlobs = options?.ignoreGlobs ?? [];
	const createVirtualParent = options?.createVirtualParent ?? true;
	const filter = options?.filter ?? (() => true);

	const fileList: Node[] = [];

	for (const filePath of sortedList) {
		const extname = path.extname(filePath).toLowerCase().trim();

		if (ignoreGlobs.some((glob) => path.matchesGlob(filePath, glob))) {
			continue;
		}

		if (extname && !extensions.has(extname)) {
			continue;
		}

		const url = parseUrl(filePath, {
			baseUrl,
			indexAsParent: true,
		});
		const current = filePath === currentPath;

		fileList.push({
			url: filePath,
			stem: url.stem,
			depth: url.depth,
			current,
			children: [],
		});
	}

	const tree: Node = createTree(fileList, createVirtualParent);

	return await walkFilter(tree, filter);
}

/**
 *
 * @param node
 * @param callback
 */
async function walkFilter(
	node: Node,
	callback: (node: Node) => Promise<boolean> | boolean,
): Promise<Node> {
	const newChildren: Node[] = [];
	for (const child of node.children) {
		if (!(await callback(child))) {
			continue;
		}
		const newChild = await walkFilter(child, callback);
		newChildren.push(newChild);
	}
	return {
		...node,
		children: newChildren,
	};
}

/**
 *
 * @param fileList
 * @param createVirtualParent
 */
function createTree(fileList: Node[], createVirtualParent: boolean) {
	const pathMap = new Map<string, Node>();

	for (const filePath of fileList) {
		pathMap.set(filePath.stem, filePath);
	}

	let root: Node | null = null;

	for (const filePath of fileList) {
		const node = pathMap.get(filePath.stem);

		if (!node) {
			continue;
		}

		if (node.depth === 0) {
			root = node;
			continue;
		}

		addParent(node, pathMap, createVirtualParent);
	}

	if (!root) {
		throw new Error('Root node not found');
	}

	return root;
}

/**
 *
 * @param node
 * @param pathMap
 * @param createVirtualParent
 */
function addParent(node: Node, pathMap: Map<string, Node>, createVirtualParent: boolean) {
	const parentStem = getParentPath(node.stem);
	const parent = pathMap.get(parentStem);

	if (parent) {
		parent.children.push(node);
		return;
	}

	if (!createVirtualParent) {
		throw new Error(`Parent node not found: "${parentStem}"`);
	}

	const virtualParent: Node = {
		url: parentStem,
		stem: parentStem,
		depth: node.depth - 1,
		current: false,
		virtual: true,
		children: [node],
	};

	pathMap.set(parentStem, virtualParent);

	addParent(virtualParent, pathMap, createVirtualParent);
}

/**
 *
 * @param filePathStem
 */
function getParentPath(filePathStem: string) {
	const urlParts = filePathStem.split('/').filter(Boolean);
	const parentParts = urlParts.slice(0, -1);
	return parentParts.length === 0 ? '/' : '/' + parentParts.join('/') + '/';
}
