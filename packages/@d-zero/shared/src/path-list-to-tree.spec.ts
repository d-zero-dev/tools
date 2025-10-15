import { test, expect } from 'vitest';

import { pathListToTree } from './path-list-to-tree.js';

test('Error', async () => {
	await expect(async () => await pathListToTree([])).rejects.toThrowError(
		'Root node not found',
	);
});

test('Create tree', async () => {
	expect(await pathListToTree(['/', '/a/', '/a/c/', '/a/b', '/e/'])).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/a/',
				stem: '/a/',
				depth: 1,
				current: false,
				children: [
					{
						url: '/a/b',
						stem: '/a/b',
						depth: 2,
						current: false,
						children: [],
					},
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
			{
				url: '/e/',
				stem: '/e/',
				depth: 1,
				current: false,
				children: [],
			},
		],
	});

	expect(
		await pathListToTree(['/', '/a/index', '/a/c/', '/a/b', '/e.html']),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/a/index',
				stem: '/a/',
				depth: 1,
				current: false,
				children: [
					{
						url: '/a/b',
						stem: '/a/b',
						depth: 2,
						current: false,
						children: [],
					},
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				children: [],
			},
		],
	});
});

test('Create tree with virtual parent', async () => {
	expect(
		await pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html']),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/a/index',
				stem: '/a/',
				depth: 1,
				current: false,
				children: [
					{
						url: '/a/c/',
						stem: '/a/c/',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
			{
				url: '/b/',
				stem: '/b/',
				depth: 1,
				current: false,
				virtual: true,
				children: [
					{
						url: '/b/d',
						stem: '/b/d',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				children: [],
			},
		],
	});
});

test('Options: createVirtualParent', async () => {
	await expect(
		async () =>
			await pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
				createVirtualParent: false,
			}),
	).rejects.toThrowError('Parent node not found: "/b/"');
});

test('Options: filter', async () => {
	expect(
		await pathListToTree(
			['/', '/a/', '/a/b.txt', '/a/c.css', '/a/d.js', '/b', '/e.html'],
			{
				filter(node) {
					return node.children.length > 0 || node.url.endsWith('.html');
				},
			},
		),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				children: [],
			},
		],
	});
});

test('Options: extensions', async () => {
	expect(
		await pathListToTree(['/', '/a/', '/a/b.html', '/a/c.css', '/d.js'], {
			extensions: ['.html', '.css'],
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/a/',
				stem: '/a/',
				depth: 1,
				current: false,
				children: [
					{
						url: '/a/b.html',
						stem: '/a/b',
						depth: 2,
						current: false,
						children: [],
					},
					{
						url: '/a/c.css',
						stem: '/a/c',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
		],
	});
});

test('Options: ignoreGlobs', async () => {
	expect(
		await pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
			ignoreGlobs: ['/a/**/*'],
		}),
	).toStrictEqual({
		url: '/',
		stem: '/',
		depth: 0,
		current: false,
		children: [
			{
				url: '/b/',
				stem: '/b/',
				depth: 1,
				current: false,
				virtual: true,
				children: [
					{
						url: '/b/d',
						stem: '/b/d',
						depth: 2,
						current: false,
						children: [],
					},
				],
			},
			{
				url: '/e.html',
				stem: '/e',
				depth: 1,
				current: false,
				children: [],
			},
		],
	});
});
