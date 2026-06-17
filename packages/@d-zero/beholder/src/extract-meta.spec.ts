import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { extractMetaFromDocument } from './extract-meta.js';

const URL = 'https://example.com/';

/**
 *
 * @param html
 */
function mkDom(html: string): JSDOM {
	return new JSDOM(html, { url: URL });
}

/**
 *
 * @param dom
 */
function asWindow(dom: JSDOM): Window {
	return dom.window as unknown as Window;
}

describe('extractMetaFromDocument', () => {
	it('extracts <title>, lang and basic <meta name=description>', async () => {
		const html = `<!doctype html>
			<html lang="ja">
				<head>
					<title>Example Title</title>
					<meta name="description" content="An example page">
					<meta name="keywords" content="a, b, c">
				</head>
				<body></body>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.title).toBe('Example Title');
		expect(meta.lang).toBe('ja');
		expect(meta.description).toBe('An example page');
		expect(meta.keywords).toBe('a, b, c');
	});

	it('parses og:* and twitter:* meta tags', async () => {
		const html = `<!doctype html>
			<html>
				<head>
					<title>OG</title>
					<meta property="og:title" content="OG Title">
					<meta property="og:type" content="article">
					<meta property="og:image" content="https://example.com/a.png">
					<meta property="og:image" content="https://example.com/b.png">
					<meta name="twitter:card" content="summary_large_image">
					<meta name="twitter:site" content="@example">
				</head>
				<body></body>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.og?.title).toBe('OG Title');
		expect(meta.og?.type).toBe('article');
		expect(meta.og?.image).toEqual([
			'https://example.com/a.png',
			'https://example.com/b.png',
		]);
		expect(meta.twitter?.card).toBe('summary_large_image');
		expect(meta.twitter?.site).toBe('@example');
	});

	it('parses viewport, robots and theme-color (with media branches)', async () => {
		const html = `<!doctype html>
			<html>
				<head>
					<title>X</title>
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<meta name="robots" content="noindex, nofollow">
					<meta name="theme-color" content="#000000">
					<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111111">
					<meta name="theme-color" media="(prefers-color-scheme: light)" content="#eeeeee">
				</head>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.viewport?.width).toBe('device-width');
		expect(meta.viewport?.initialScale).toBe(1);
		expect(meta.robots?.noindex).toBe(true);
		expect(meta.robots?.nofollow).toBe(true);
		expect(meta.themeColor).toBe('#000000');
		expect(meta.themeColorDark).toBe('#111111');
		expect(meta.themeColorLight).toBe('#eeeeee');
	});

	it('captures <link rel="canonical"> and alternate hreflang', async () => {
		const html = `<!doctype html>
			<html>
				<head>
					<title>L</title>
					<link rel="canonical" href="https://example.com/canonical">
					<link rel="alternate" hreflang="en" href="https://example.com/en">
					<link rel="alternate" hreflang="ja" href="https://example.com/ja">
				</head>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.link?.canonical).toBe('https://example.com/canonical');
		const hreflangs = meta.link?.alternateHreflang.map((e) => e.hreflang) ?? [];
		expect(hreflangs).toEqual(['en', 'ja']);
	});

	it('parses inline JSON-LD scripts', async () => {
		const data = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'X' };
		const html = `<!doctype html>
			<html>
				<head>
					<title>J</title>
					<script type="application/ld+json">${JSON.stringify(data)}</script>
				</head>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.jsonLd).toHaveLength(1);
		const first = meta.jsonLd[0];
		expect(first?.parsed).toEqual(data);
	});

	it('captures itemtype/itemscope (microdata) and prefix/vocab (RDFa) from <html>', async () => {
		const html = `<!doctype html>
			<html itemscope itemtype="https://schema.org/WebPage" prefix="og: https://ogp.me/ns#" vocab="https://schema.org/" typeof="WebPage">
				<head><title>M</title></head>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.microdata?.itemscope).toBe(true);
		expect(meta.microdata?.itemtype).toBe('https://schema.org/WebPage');
		expect(meta.rdfa?.prefix).toBe('og: https://ogp.me/ns#');
		expect(meta.rdfa?.vocab).toBe('https://schema.org/');
		expect(meta.rdfa?.typeOf).toBe('WebPage');
	});

	it('captures <base href> and <iframe src>', async () => {
		const html = `<!doctype html>
			<html>
				<head>
					<title>B</title>
					<base href="https://example.com/sub/">
				</head>
				<body>
					<iframe src="https://www.youtube.com/embed/abc"></iframe>
				</body>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.baseHref).toBe('https://example.com/sub/');
		expect(meta.others.iframe).toEqual([
			{ src: 'https://www.youtube.com/embed/abc', location: 'body' },
		]);
	});

	it('falls back to documentElement.outerHTML when context.html is omitted', async () => {
		const html = `<!doctype html><html><head><title>FB</title></head></html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL });
		expect(meta.title).toBe('FB');
		expect(meta.tags).toBeDefined();
		expect(meta.tags.entries).toBeInstanceOf(Array);
	});

	it('returns includeRaw when requested', async () => {
		const html = `<!doctype html><html><head><title>R</title></head></html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), {
			url: URL,
			html,
			includeRaw: true,
		});
		expect(meta._raw).toBeInstanceOf(Array);
		expect(meta._raw?.some((e) => e.kind === 'title')).toBe(true);
	});

	it("emits a 'window-global' raw entry when known globals are present on the window", async () => {
		const html = `<!doctype html><html><head><title>WG</title></head></html>`;
		const dom = mkDom(html);
		// jsdom does not execute scripts by default, so simulate a tag library
		// having installed itself onto `window` (the production trigger for the
		// `window-global` branch in `collectHeadFromDocument`).
		(dom.window as unknown as Record<string, unknown>).dataLayer = [];
		(dom.window as unknown as Record<string, unknown>).fbq = () => {};

		const meta = await extractMetaFromDocument(asWindow(dom), {
			url: URL,
			html,
			includeRaw: true,
		});

		const globalEntry = meta._raw?.find((e) => e.kind === 'window-global');
		expect(globalEntry).toBeDefined();
		// Force a type error if the narrow ever fails, rather than letting the
		// trailing `expect` calls silently skip via an `if` branch.
		if (globalEntry === undefined || globalEntry.kind !== 'window-global') {
			throw new Error('expected a window-global raw entry');
		}
		expect(globalEntry.names).toContain('dataLayer');
		expect(globalEntry.names).toContain('fbq');
	});

	it('forwards headers and statusCode to the tag-detection layer', async () => {
		// We can't assert Wappalyzer's internal decisions without coupling to its
		// signature table, but we can at least verify that supplying headers and
		// statusCode does not throw and that the returned Meta is still well-formed.
		const html = `<!doctype html><html><head><title>H</title></head></html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), {
			url: URL,
			html,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'x-powered-by': 'Express',
			},
			statusCode: 200,
		});
		expect(meta.title).toBe('H');
		expect(Array.isArray(meta.tags.entries)).toBe(true);
	});

	it('records parseError for malformed inline JSON-LD', async () => {
		const html = `<!doctype html>
			<html>
				<head>
					<title>JE</title>
					<script type="application/ld+json">{ this is not valid json</script>
				</head>
			</html>`;
		const dom = mkDom(html);
		const meta = await extractMetaFromDocument(asWindow(dom), { url: URL, html });

		expect(meta.jsonLd).toHaveLength(1);
		const first = meta.jsonLd[0];
		expect(first?.parsed).toBeUndefined();
		expect(typeof first?.parseError).toBe('string');
	});
});
