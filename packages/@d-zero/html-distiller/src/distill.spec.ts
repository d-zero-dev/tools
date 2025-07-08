import { test, expect } from 'vitest';

import { distill } from './distill.js';

test('Basic', async () => {
	expect(
		await distill(`<html lang="en">
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
						content: ['<title>Test</title>'],
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

test('Specific nodes', async () => {
	expect(
		await distill(`<html lang="en">
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
							'<script>console.log("Hello, World!");</script>',
							'<style>h1 {\n\t\t\t\tcolor: red;\n\t\t\t}</style>',
							'<title>Test</title>',
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
