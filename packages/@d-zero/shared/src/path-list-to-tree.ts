import path from 'node:path';

import { parseUrl } from './parse-url.js';
import { pathComparator } from './sort/path.js';

export type PathListToTreeOptions<MetaData = Record<string, unknown>> = {
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
	filter?: (node: Node<MetaData>) => boolean;
};

export type Node<MetaData = Record<string, unknown>> = {
	url: string;
	stem: string;
	depth: number;
	current: boolean;
	isAncestor: boolean;
	virtual?: true;
	meta?: MetaData;
	children: Node<MetaData>[];
};

/**
 *
 * @param pathList
 * @param options
 */
export function pathListToTree<MetaData = Record<string, unknown>>(
	pathList: string[],
	options?: PathListToTreeOptions<MetaData>,
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

	const fileList: Node<MetaData>[] = [];

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
			isAncestor: !current && currentPath ? currentPath.startsWith(url.stem) : false,
			children: [],
		});
	}

	const tree: Node<MetaData> = createTree(fileList, createVirtualParent);

	return walkFilter(tree, filter);
}

/**
 *
 * @param node
 * @param callback
 */
function walkFilter<MetaData = Record<string, unknown>>(
	node: Node<MetaData>,
	callback: (node: Node<MetaData>) => boolean,
): Node<MetaData> {
	const newChildren: Node<MetaData>[] = [];
	for (const child of node.children) {
		if (!callback(child)) {
			continue;
		}
		const newChild = walkFilter(child, callback);
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
function createTree<MetaData = Record<string, unknown>>(
	fileList: Node<MetaData>[],
	createVirtualParent: boolean,
) {
	const pathMap = new Map<string, Node<MetaData>>();

	for (const filePath of fileList) {
		pathMap.set(filePath.stem, filePath);
	}

	for (const filePath of fileList) {
		const node = pathMap.get(filePath.stem);

		if (!node) {
			continue;
		}

		addParent(node, pathMap, createVirtualParent);
	}

	const root = pathMap.get('/');

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
function addParent<MetaData = Record<string, unknown>>(
	node: Node<MetaData>,
	pathMap: Map<string, Node<MetaData>>,
	createVirtualParent: boolean,
) {
	const parentStem = getParentPath(node.stem);

	if (!parentStem) {
		return;
	}

	const parent = pathMap.get(parentStem);

	if (parent) {
		parent.children.push(node);
		return;
	}

	if (!createVirtualParent) {
		throw new Error(`Parent node not found: "${parentStem}"`);
	}

	const virtualParent: Node<MetaData> = {
		url: parentStem,
		stem: parentStem,
		depth: node.depth - 1,
		current: false,
		isAncestor: node.current || node.isAncestor,
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
	if (filePathStem === '/') {
		return null;
	}
	const urlParts = filePathStem.split('/').filter(Boolean);
	const parentParts = urlParts.slice(0, -1);
	return parentParts.length === 0 ? '/' : '/' + parentParts.join('/') + '/';
}
