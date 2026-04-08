import { it, expect } from 'vitest';

import { pathMatch } from './path-match.js';

it('matches', () => {
	expect(pathMatch('https://example.com', '/')).toBe(true);
	expect(pathMatch('https://example.com/', '/')).toBe(true);
	expect(pathMatch('https://example.com', '')).toBe(true);
	expect(pathMatch('https://example.com/', '')).toBe(true);
});

it('glob pattern', () => {
	expect(pathMatch('https://example.com', '/')).toBe(true);
	expect(pathMatch('https://example.com/blog/', '/blog/')).toBe(true);
	expect(pathMatch('https://example.com/blog/0', '/blog/*')).toBe(true);
	expect(pathMatch('https://example.com/blog/2020/01/01', '/blog/**/*')).toBe(true);
	expect(pathMatch('https://example.com/blog/0', '/blog/**/*')).toBe(true);
	expect(pathMatch('https://example.com/blog/index01.html', '/**/*')).toBe(true);
	expect(pathMatch('https://example.com/blog/index01.html', '/**/index*')).toBe(true);
	expect(pathMatch('https://example.com/blog/index01.html', '/**/index*.html')).toBe(
		true,
	);
});

it('does not match', () => {
	expect(pathMatch('https://example.com/blog/index01.html', '/**/index')).toBe(false);
	expect(pathMatch('https://example.com/blog/index01.html', '*')).toBe(false);
	expect(pathMatch('https://example.com/blog/index01.html', 'index*')).toBe(false);
	expect(pathMatch('https://example.com/blog/index01.html', 'index*.html')).toBe(false);
	expect(pathMatch('https://example.com/blog/index01.html', 'index0*.html')).toBe(false);
});
