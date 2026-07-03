import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { hashContent } from './hash-content.js';
import { tokenize } from './tokenize.js';

const fixturesDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'__fixtures__',
);

/**
 *
 * @param name
 */
function readFixture(name: string): string {
	return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

/**
 *
 * @param tokens
 */
function stripShas(tokens: string[]): string[] {
	return tokens.map((token) => token.replaceAll(/sha=[0-9a-f]{16}/g, 'sha=X'));
}

describe('tokenize (fixtures)', () => {
	test('product grid: repeated identical cards produce repeated identical paths (no compression)', () => {
		const cardLeaves = [
			'body>main.product-list>.grid>.card>img.thumb',
			'body>main.product-list>.grid>.card>h3',
			'body>main.product-list>.grid>.card>p.price',
		];
		expect(tokenize(readFixture('product-grid.html'))).toStrictEqual([
			...cardLeaves,
			...cardLeaves,
			...cardLeaves,
		]);
	});

	test('blog article: visible text is ignored entirely; mixed leaf/non-leaf paragraphs', () => {
		expect(tokenize(readFixture('blog-article.html'))).toStrictEqual([
			'body>article>h1',
			'body>article>p',
			'body>article>p>a',
		]);
	});

	test('nav header: a `current` state class on one sibling does not collapse or corrupt the others', () => {
		expect(tokenize(readFixture('nav-header.html'))).toStrictEqual([
			'body>header>nav.main-nav>ul>li>a',
			'body>header>nav.main-nav>ul>li.current>a',
			'body>header>nav.main-nav>ul>li>a',
		]);
	});

	test('form: input/button `type` is preserved as structural signal', () => {
		expect(tokenize(readFixture('form.html'))).toStrictEqual([
			'body>form>input[type=text]',
			'body>form>input[type=checkbox]',
			'body>form>input[type=radio]',
			'body>form>input[type=email]',
			'body>form>button[type=submit]',
		]);
	});

	test('svg sprite: each svg is one opaque leaf; role is preserved; self-nesting does not truncate early', () => {
		const raw = tokenize(readFixture('svg-sprite.html'));
		expect(raw).toHaveLength(3);
		expect(stripShas(raw)).toStrictEqual([
			'body>.icons>svg[sha=X]',
			'body>.icons>svg[role=img,sha=X]',
			'body>.icons>svg[sha=X]',
		]);
		// The two role-less svgs have different raw content (a <path> vs a
		// self-nested <svg><rect/></svg>), so their hashes must differ — if the
		// self-nesting depth counter mistakenly matched the *inner* </svg> as
		// the close of the *outer* svg, the captured content would be truncated
		// and this could accidentally coincide with another entry.
		const shaOf = (token: string) => /sha=([0-9a-f]{16})/.exec(token)?.[1];
		expect(shaOf(raw[0] ?? '')).not.toBe(shaOf(raw[2] ?? ''));
	});

	test('script + ld+json: type is preserved on opaque elements alongside the content hash', () => {
		const raw = tokenize(readFixture('script-ld-json.html'));
		expect(stripShas(raw)).toStrictEqual([
			'body>.page>script[sha=X,type=application/ld+json]',
			'body>.page>script[sha=X]',
		]);
	});

	test('noisy classes: default filtering collapses auto-generated-class wrappers via folding', () => {
		expect(tokenize(readFixture('noisy-classes.html'))).toStrictEqual(['body>span']);
	});

	test('noisy classes: disabling the filter keeps every class and prevents folding', () => {
		expect(
			tokenize(readFixture('noisy-classes.html'), { filterNoiseClasses: false }),
		).toStrictEqual(['body>.sc-a1b2c3>.css-4d5e6f>._g7h8i9']);
	});
});

describe('tokenize (stress cases)', () => {
	test('50 levels of class-less wrapper divs all fold away', () => {
		const html = `<body>${'<div>'.repeat(50)}<span>x</span>${'</div>'.repeat(50)}</body>`;
		expect(tokenize(html)).toStrictEqual(['body>span']);
	});

	test('1000 identical siblings are all emitted, uncompressed, without pathological slowness', () => {
		const html = `<body><ul>${'<li></li>'.repeat(1000)}</ul></body>`;
		const start = performance.now();
		const result = tokenize(html);
		const elapsedMs = performance.now() - start;

		expect(result).toHaveLength(1000);
		expect(result.every((token) => token === 'body>ul>li')).toBe(true);
		expect(elapsedMs).toBeLessThan(1000);
	});

	test('200,000 flat siblings do not crash (regression: spread-push into Array#push overflows the call stack)', () => {
		// A flat, high-fan-out template (a sitemap/index/listing page) is
		// exactly the shape this package is meant to cluster at crawl scale.
		// `pendingPaths.push(...contributed)` used to spread the whole
		// completed-children array as call arguments, which throws
		// `RangeError: Maximum call stack size exceeded` once it crosses
		// roughly 120k entries — see `run-tokenizer.ts` for the fix (a plain
		// loop instead of a spread).
		const html = `<body><ul>${'<li></li>'.repeat(200_000)}</ul></body>`;

		let result: string[] = [];
		const start = performance.now();
		expect(() => {
			result = tokenize(html);
		}).not.toThrow();
		const elapsedMs = performance.now() - start;

		expect(result).toHaveLength(200_000);
		expect(result.every((token) => token === 'body>ul>li')).toBe(true);
		// Generous budget: this only needs to catch an accidental O(n²)
		// reintroduction, not enforce a tight performance SLA.
		expect(elapsedMs).toBeLessThan(5000);
	});
});

describe('tokenize (malformed HTML)', () => {
	test('unclosed <li> siblings are recovered via implicit closing', () => {
		expect(tokenize('<body><ul><li>A<li>B</ul></body>')).toStrictEqual([
			'body>ul>li',
			'body>ul>li',
		]);
	});

	test('a document truncated mid-tag is force-closed at end of input', () => {
		expect(tokenize('<body><div><span>a')).toStrictEqual(['body>span']);
	});

	test('no <body> at all returns an empty array', () => {
		expect(tokenize('<html><head><title>x</title></head></html>')).toStrictEqual([]);
	});

	test('empty input returns an empty array', () => {
		expect(tokenize('')).toStrictEqual([]);
	});

	test('an empty <body> is itself a leaf', () => {
		expect(tokenize('<body></body>')).toStrictEqual(['body']);
	});

	test('a second top-level <body> in malformed markup is ignored', () => {
		expect(tokenize('<body><div>1</div></body><body><div>2</div></body>')).toStrictEqual([
			'body>div',
		]);
	});

	test('a <body> tag nested inside real body content is ignored, but its content is not', () => {
		expect(tokenize('<body><div><body><span>x</span></body></div></body>')).toStrictEqual(
			['body>span'],
		);
	});

	test('a comment as the only content of an otherwise-childless element is not silently dropped', () => {
		const sha = hashContent(' only comment ');
		expect(
			tokenize('<body><div><!-- only comment --></div></body>', {
				includeComments: true,
			}),
		).toStrictEqual([`body>div>comment[sha=${sha}]`]);
	});

	test('comments are ignored by default, even when the input contains one', () => {
		expect(tokenize('<body><!-- c --><div>x</div></body>')).toStrictEqual(['body>div']);
	});

	test('an enabled comment is interleaved with real siblings in document order', () => {
		const sha = hashContent(' c ');
		expect(
			tokenize('<body><span>a</span><!-- c --><span>b</span></body>', {
				includeComments: true,
			}),
		).toStrictEqual(['body>span', `body>comment[sha=${sha}]`, 'body>span']);
	});
});

describe('tokenize (attribute notation variance)', () => {
	test('uppercase tags/attributes and unquoted values are normalized the same as lowercase/quoted ones', () => {
		const html = '<BODY><DIV CLASS="Card"  ROLE=button><SPAN>x</SPAN></DIV></BODY>';
		expect(tokenize(html)).toStrictEqual(['body>.Card[role=button]>span']);
	});
});
