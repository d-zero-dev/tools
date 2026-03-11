import { test, expect } from 'vitest';

import { pathListToTree } from './path-list-to-tree.js';

test('Error', () => {
	expect(() => pathListToTree([])).toThrowError('Root node not found');
});

test('Create tree', () => {
	expect(pathListToTree(['/', '/a/', '/a/c/', '/a/b', '/e/'])).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/a/',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [
					{
						url: '/a/b',
						stem: '/a/b',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/e/',
				stem: '/e/',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});

	expect(pathListToTree(['/', '/a/index', '/a/c/', '/a/b', '/e.html'])).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/a/index',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [
					{
						url: '/a/b',
						stem: '/a/b',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});
});

test('Create tree (intermediate path is missing)', () => {
	expect(pathListToTree(['/a/b/', '/a/b/c/d/e'])).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		virtual: true,
		children: [
			{
				url: '/a/',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: false,
				virtual: true,
				children: [
					{
						url: '/a/b/',
						stem: '/a/b/',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [
							{
								url: '/a/b/c/',
								stem: '/a/b/c/',
								depth: 3,
								current: false,
								isAncestor: false,
								virtual: true,
								children: [
									{
										url: '/a/b/c/d/',
										stem: '/a/b/c/d/',
										depth: 4,
										current: false,
										isAncestor: false,
										virtual: true,
										children: [
											{
												url: '/a/b/c/d/e',
												stem: '/a/b/c/d/e',
												depth: 5,
												current: false,
												isAncestor: false,
												children: [],
											},
										],
									},
								],
							},
						],
					},
				],
			},
		],
	});
});

test('Create tree with virtual parent', () => {
	expect(pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'])).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/a/index',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/b/',
				stem: '/b/',
				depth: 1,
				current: false,
				isAncestor: false,
				virtual: true,
				children: [
					{
						url: '/b/d',
						stem: '/b/d',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});
});

test('Options: createVirtualParent', () => {
	expect(() =>
		pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
			createVirtualParent: false,
		}),
	).toThrowError('Parent node not found: "/b/"');
});

test('Options: filter', () => {
	expect(
		pathListToTree(['/', '/a/', '/a/b.txt', '/a/c.css', '/a/d.js', '/b', '/e.html'], {
			filter(node) {
				return node.children.length > 0 || node.url.endsWith('.html');
			},
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});
});

test('Options: extensions', () => {
	expect(
		pathListToTree(['/', '/a/', '/a/b.html', '/a/c.css', '/d.js'], {
			extensions: ['.html', '.css'],
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/a/',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [
					{
						url: '/a/b.html',
						stem: '/a/b',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
					{
						url: '/a/c.css',
						stem: '/a/c',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
		],
	});
});

test('Options: ignoreGlobs', () => {
	expect(
		pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
			ignoreGlobs: ['/a/**/*'],
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: false,
		children: [
			{
				url: '/b/',
				stem: '/b/',
				depth: 1,
				current: false,
				isAncestor: false,
				virtual: true,
				children: [
					{
						url: '/b/d',
						stem: '/b/d',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});
});

test('Options: currentPath', () => {
	expect(
		pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
			currentPath: '/a/c/',
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		isAncestor: true,
		children: [
			{
				url: '/a/index',
				stem: '/a/',
				depth: 1,
				current: false,
				isAncestor: true,
				children: [
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: true,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/b/',
				stem: '/b/',
				depth: 1,
				current: false,
				isAncestor: false,
				virtual: true,
				children: [
					{
						url: '/b/d',
						stem: '/b/d',
						depth: 2,
						current: false,
						isAncestor: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				isAncestor: false,
				children: [],
			},
		],
	});
});

test('Options: addMetaData adds meta to every node', () => {
	const result = pathListToTree(['/', '/a/', '/a/b', '/a/c/'], {
		addMetaData: (node) => ({
			stem: node.stem,
			depth: node.depth,
		}),
	});

	expect(result.meta).toStrictEqual({ stem: '/', depth: 0 });
	expect(result.children).toHaveLength(1);
	expect(result.children[0]?.meta).toStrictEqual({ stem: '/a/', depth: 1 });
	expect(result.children[0]?.children).toHaveLength(2);
	expect(result.children[0]?.children[0]?.meta).toStrictEqual({ stem: '/a/b', depth: 2 });
	expect(result.children[0]?.children[1]?.meta).toStrictEqual({
		stem: '/a/c/',
		depth: 2,
	});
});

test('Options: addMetaData with custom MetaData type', () => {
	type CustomMeta = { label: string; isLeaf: boolean };
	const result = pathListToTree<CustomMeta>(['/', '/a/', '/a/b'], {
		addMetaData: (node) => ({
			label: node.stem,
			isLeaf: node.children.length === 0,
		}),
	});

	expect(result.meta).toStrictEqual({ label: '/', isLeaf: false });
	expect(result.children[0]?.meta).toStrictEqual({ label: '/a/', isLeaf: false });
	expect(result.children[0]?.children[0]?.meta).toStrictEqual({
		label: '/a/b',
		isLeaf: true,
	});
});

test('Options: addMetaData is applied after filter', () => {
	const result = pathListToTree(['/', '/a/', '/a/b', '/a/c/'], {
		filter: (node) => node.stem !== '/a/b',
		addMetaData: (node) => ({ stem: node.stem }),
	});

	expect(result.meta).toStrictEqual({ stem: '/' });
	expect(result.children[0]?.meta).toStrictEqual({ stem: '/a/' });
	expect(result.children[0]?.children).toHaveLength(1);
	expect(result.children[0]?.children[0]?.stem).toBe('/a/c/');
	expect(result.children[0]?.children[0]?.meta).toStrictEqual({ stem: '/a/c/' });
});

test('Options: without addMetaData, nodes have no meta property', () => {
	const result = pathListToTree(['/', '/a/']);
	expect(result).not.toHaveProperty('meta');
	expect(result.children[0]).not.toHaveProperty('meta');
});

test('Options: comparator null preserves original order', () => {
	const input = ['/', '/z/', '/a/', '/m/'];
	const inputCopy = [...input];
	const result = pathListToTree(input, {
		comparator: null,
	});

	expect(result.children.map((c) => c.stem)).toStrictEqual(['/z/', '/a/', '/m/']);
	expect(input).toStrictEqual(inputCopy);
});

test('Options: comparator null with currentPath', () => {
	const result = pathListToTree(['/', '/z/', '/a/', '/m/'], {
		comparator: null,
		currentPath: '/a/',
	});

	expect(result.children.map((c) => c.stem)).toStrictEqual(['/z/', '/a/', '/m/']);
	expect(result.isAncestor).toBe(true);
	expect(result.children[1]?.current).toBe(true);
});

test('Options: comparator with custom function', () => {
	const result = pathListToTree(['/', '/a/', '/c/', '/b/'], {
		comparator: (a, b) => b.localeCompare(a),
	});

	expect(result.children.map((c) => c.stem)).toStrictEqual(['/c/', '/b/', '/a/']);
});

test('Options: comparator with custom function sorts before tree construction', () => {
	const result = pathListToTree(['/', '/b/', '/a/', '/b/x', '/a/y'], {
		comparator: (a, b) => b.localeCompare(a),
	});

	expect(result.children.map((c) => c.stem)).toStrictEqual(['/b/', '/a/']);
	expect(result.children[0]?.children.map((c) => c.stem)).toStrictEqual(['/b/x']);
	expect(result.children[1]?.children.map((c) => c.stem)).toStrictEqual(['/a/y']);
});

test('Options: comparator "path" behaves same as default', () => {
	const input = ['/', '/c/', '/a/', '/b/'];
	const defaultResult = pathListToTree(input);
	const explicitResult = pathListToTree(input, { comparator: 'path' });

	expect(explicitResult).toStrictEqual(defaultResult);
});
