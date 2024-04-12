# HTML Distiller

A tool for precisely extracting essential information from HTML, enhancing machine readability. It removes unnecessary elements and provides the needed data in JSON format.

## Install

```shell
npm install @d-zero/html-distiller
```

## API

```ts
import { distill } from '@d-zero/html-distiller';

const html = `
<!DOCTYPE html>
<html lang="en">
	<head>
		<title>Test</title>
	</head>
	<body>
		<h1>Hello, World!</h1>
	</body>
</html>
`;

const result = distill(html);
console.log(result);
```

## Output

```json
{
	"tree": [
		{
			"name": "html",
			"attr": {
				"lang": "en"
			},
			"content": [
				{
					"name": "head",
					"content": [
						{
							"name": "title",
							"content": ["Test"]
						}
					]
				},
				{
					"name": "body",
					"content": [
						{
							"name": "h1",
							"content": ["Hello, World!"]
						}
					]
				}
			]
		}
	]
}
```
