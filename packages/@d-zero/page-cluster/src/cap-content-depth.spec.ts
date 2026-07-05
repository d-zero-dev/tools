import { describe, expect, test } from 'vitest';

import { capContentDepth } from './cap-content-depth.js';

describe('capContentDepth', () => {
	test('matches the exact output documented in the JSDoc @example', () => {
		// Kept in sync with capContentDepth's @example: if this ever fails, the
		// JSDoc example is out of date and must be corrected alongside the
		// implementation, not the other way around.
		const result = capContentDepth(
			'<body><main><div><div><div><div>too deep</div></div></div></div></main></body>',
			{ landmark: 'main', maxDepth: 2 },
		);
		expect(result).toStrictEqual({
			remainderHtml: '<body><main><div><div></div></div></main></body>',
		});
	});

	test('content shallower than maxDepth is left completely unchanged', () => {
		const html = '<body><main><div><p>shallow</p></div></main></body>';
		expect(capContentDepth(html, { landmark: 'main', maxDepth: 3 })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('role="main" is recognized even without a <main> tag', () => {
		const result = capContentDepth(
			'<body><div role="main"><div><div><div>deep</div></div></div></div></body>',
			{ landmark: 'main', maxDepth: 1 },
		);
		expect(result.remainderHtml).toBe('<body><div role="main"><div></div></div></body>');
	});

	test('a page with no <main> and no role="main" is left unchanged', () => {
		const html = '<body><p>no main here</p></body>';
		expect(capContentDepth(html, { landmark: 'main', maxDepth: 1 })).toStrictEqual({
			remainderHtml: html,
		});
	});

	test('<main> itself (its own opening and closing tags, including attributes) is always kept, even at maxDepth 0', () => {
		const result = capContentDepth(
			'<body><main class="detail"><div>content</div></main></body>',
			{ landmark: 'main', maxDepth: 0 },
		);
		expect(result.remainderHtml).toBe('<body><main class="detail"></main></body>');
	});

	test('multiple independent too-deep branches at the same level are each capped correctly', () => {
		const html =
			'<body><main><section><div><div>deep-a</div></div></section><section><div><div>deep-b</div></div></section></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 2 });
		expect(result.remainderHtml).toBe(
			'<body><main><section><div></div></section><section><div></div></section></main></body>',
		);
	});

	test('multiple <main> elements (malformed markup): the shallowest one wins, matching extractLandmarks', () => {
		const html =
			'<body><div><main><div><div><div>deep</div></div></div></main></div><main><div><div><div>also-deep</div></div></div></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		// The second <main> (depth 0, direct child of body) is shallower than
		// the first (depth 1, nested inside a <div>), so it wins.
		expect(result.remainderHtml).toBe(
			'<body><div><main><div><div><div>deep</div></div></div></main></div><main><div></div></main></body>',
		);
	});

	test('content inside an opaque tag (script) is never counted toward depth or capped', () => {
		const html =
			'<body><main><div><script>var deep = { a: { b: { c: 1 } } };</script></div></main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		expect(result.remainderHtml).toBe(html);
	});

	test('an unclosed too-deep element is left in place rather than corrupting the remainder', () => {
		// No closing </div> for the too-deep element before </main> arrives —
		// htmlparser2 force-closes it at a position that doesn't correspond to
		// any real closing tag for it, so isGenuineClose rejects the candidate
		// and it is not excised.
		const html = '<body><main><div><div>unclosed</main></body>';
		const result = capContentDepth(html, { landmark: 'main', maxDepth: 1 });
		expect(result.remainderHtml).toBe(html);
	});

	test.each([-1, 0.5, Number.NaN])(
		'rejects a maxDepth that is not a non-negative integer (%s)',
		(maxDepth) => {
			expect(() =>
				capContentDepth('<body><main></main></body>', { landmark: 'main', maxDepth }),
			).toThrow(RangeError);
		},
	);
});
