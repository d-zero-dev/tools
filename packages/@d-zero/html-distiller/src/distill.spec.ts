import { test, expect } from 'vitest';

import { distill } from './distill.js';

test('Basic', () => {
	expect(
		distill(`<html lang="en">
	<head>
		<title>Test</title>
	</head>
	<body>
		<h1>Hello, World!</h1>
	</body>
</html>`),
	).toStrictEqual({
		tree: [
			{
				name: 'html',
				attr: {
					lang: 'en',
				},
				content: [
					{
						name: 'head',
						content: [
							{
								name: 'title',
								content: ['Test'],
							},
						],
					},
					{
						name: 'body',
						content: [
							{
								name: 'h1',
								content: ['Hello, World!'],
							},
						],
					},
				],
			},
		],
	});
});

test('Specific nodes', () => {
	expect(
		distill(`<html lang="en">
	<head>
		<title>Test</title>
		<script>console.log("Hello, World!")</script>
		<style>h1 { color: red; }</style>
	</head>
	<body>
		<!-- Comment -->
		<template id="tmpl">
			<h1>Hello, World!</h1>
		</template>
	</body>
</html>`),
	).toStrictEqual({
		tree: [
			{
				name: 'html',
				attr: {
					lang: 'en',
				},
				content: [
					{
						name: 'head',
						content: [
							{
								name: 'title',
								content: ['Test'],
							},
							{
								name: 'script',
								content: ['console.log("Hello, World!")'],
							},
							{
								name: 'style',
								content: ['h1 { color: red; }'],
							},
						],
					},
					{
						name: 'body',
						content: [
							'<!-- Comment -->',
							{
								name: 'template',
								attr: {
									id: 'tmpl',
								},
								content: [
									{
										name: 'h1',
										content: ['Hello, World!'],
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
