import path from 'node:path';

import { parseUrl } from './parse-url.js';
import { pathComparator } from './sort/path.js';

/**
 * Options for building a tree from a list of file paths.
 * @template MetaData - Type of optional meta data attached to each node via addMetaData.
 */
export type PathListToTreeOptions<MetaData = Record<string, unknown>> = {
	/** Path to treat as the current item (sets current and isAncestor on nodes). */
	currentPath?: string;

	/** Base URL used when parsing paths to stems (e.g. for index-as-parent). */
	baseUrl?: string;

	/** File extensions to include; defaults include .html and .htm. */
	extensions?: string[];

	/** Glob patterns for paths to ignore. */
	ignoreGlobs?: string[];

	/** When true, create virtual parent nodes for missing ancestors; when false, throw. */
	createVirtualParent?: boolean;

	/** Predicate to include or exclude each node; excluded nodes and their descendants are removed. */
	filter?: (node: Node<MetaData>) => boolean;

	/** Callback to compute meta data for each node; applied after filtering. */
	addMetaData?: (node: Node<MetaData>) => MetaData;
};

/**
 * A node in the path tree.
 * @template MetaData - Type of optional meta data when addMetaData is used.
 */
export type Node<MetaData = Record<string, unknown>> = {
	/** Original path/URL of the file or directory. */
	url: string;
	/** Normalized stem (path segment used as node key). */
	stem: string;
	/** Depth in the tree (0 for root). */
	depth: number;
	/** True if this node is the current path. */
	current: boolean;
	/** True if the current path is under this node. */
	isAncestor: boolean;
	/** Present when the node was created as a virtual parent (no real file). */
	virtual?: true;
	/** Optional meta data when addMetaData option is provided. */
	meta?: MetaData;
	/** Child nodes. */
	children: Node<MetaData>[];
};

/**
 * Builds a tree from a sorted list of file paths.
 * Paths are filtered by extensions and ignoreGlobs, then organized into a tree.
 * Optional filter and addMetaData are applied in that order.
 * @template MetaData - Type of meta data when addMetaData option is used.
 * @param pathList - Array of file paths (e.g. from a file system or URL list).
 * @param options - Options for filtering, current path, and meta data.
 * @returns Root node of the tree (stem '/').
 * @throws {Error} When pathList is empty or missing root, or when a parent is missing and createVirtualParent is false.
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

	let tree: Node<MetaData> = createTree(fileList, createVirtualParent);
	tree = walkFilter(tree, filter);
	if (options?.addMetaData) {
		tree = walkForAddMetaData(tree, options.addMetaData);
	}

	return tree;
}

/**
 * Recursively filters the tree; nodes for which callback returns false (and their descendants) are removed.
 * @template MetaData - Node meta type.
 * @param node - Current node.
 * @param callback - Predicate; return false to exclude the node and its subtree.
 * @returns New node with filtered children (shallow copy of node with new children array).
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
 * Recursively attaches meta data to each node via the given callback.
 * @template MetaData - Type of meta attached to each node.
 * @param node - Current node.
 * @param createMetaData - Function that returns meta for the node (receives node without meta).
 * @returns New node with meta and recursively updated children (shallow copy).
 */
function walkForAddMetaData<MetaData = Record<string, unknown>>(
	node: Node<MetaData>,
	createMetaData: (node: Node<MetaData>) => MetaData,
) {
	const metaData = createMetaData(node);
	const newChildren: Node<MetaData>[] = [];
	for (const child of node.children) {
		const newChild = walkForAddMetaData(child, createMetaData);
		newChildren.push(newChild);
	}
	return {
		...node,
		meta: metaData,
		children: newChildren,
	};
}

/**
 * Builds a tree from a flat list of nodes by linking each node to its parent.
 * Missing parents are either created as virtual nodes or cause an error depending on createVirtualParent.
 * @template MetaData - Node meta type.
 * @param fileList - Flat list of nodes (each with stem and empty children).
 * @param createVirtualParent - If true, create virtual parents for missing stems; if false, throw.
 * @returns Root node (stem '/').
 * @throws {Error} When root node is missing or a parent is missing and createVirtualParent is false.
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
 * Links a node to its parent: finds or creates the parent and appends this node to parent.children.
 * @template MetaData - Node meta type.
 * @param node - Node to attach to its parent.
 * @param pathMap - Map of stem to node; may be mutated to add virtual parents.
 * @param createVirtualParent - If true, create a virtual parent when missing; if false, throw.
 * @throws {Error} When parent stem is missing from pathMap and createVirtualParent is false.
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
 * Returns the parent path stem for a given stem (e.g. '/a/b/c/' -> '/a/b/').
 * @param filePathStem - Stem string (path segment form, e.g. '/' or '/a/b/').
 * @returns Parent stem, or null if the stem is root ('/').
 */
function getParentPath(filePathStem: string) {
	if (filePathStem === '/') {
		return null;
	}
	const urlParts = filePathStem.split('/').filter(Boolean);
	const parentParts = urlParts.slice(0, -1);
	return parentParts.length === 0 ? '/' : '/' + parentParts.join('/') + '/';
}
