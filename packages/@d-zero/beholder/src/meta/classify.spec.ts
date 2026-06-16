import type { RawHeadEntry } from './types.js';

import { describe, expect, it } from 'vitest';

import { classify, emptyMeta, setByPath } from './classify.js';

describe('emptyMeta', () => {
	it('initializes all required fields with empty values', () => {
		const meta = emptyMeta();
		expect(meta.title).toBe('');
		expect(meta.originTrial).toEqual([]);
		expect(meta.jsonLd).toEqual([]);
		expect(meta.speculationRules).toEqual([]);
		expect(meta.tags).toEqual({ detected: {}, entries: [] });
		expect(meta.others).toEqual({
			meta: {},
			property: {},
			httpEquiv: {},
			itemprop: {},
			link: [],
			script: [],
			iframe: [],
		});
	});
});

describe('setByPath', () => {
	it('creates intermediate objects', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'a.b.c', 1, false);
		expect(obj).toEqual({ a: { b: { c: 1 } } });
	});

	it('keeps first assignment when multi=false', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'k', 'first', false);
		setByPath(obj, 'k', 'second', false);
		expect(obj.k).toBe('first');
	});

	it('appends to leaf array when multi=true', () => {
		const obj: Record<string, unknown> = {};
		setByPath(obj, 'list', 'a', true);
		setByPath(obj, 'list', 'b', true);
		expect(obj.list).toEqual(['a', 'b']);
	});
});

describe('classify', () => {
	it('captures title and html attributes', () => {
		const raw: RawHeadEntry[] = [
			{
				kind: 'html',
				lang: 'ja',
				dir: 'ltr',
				prefix: 'og: https://ogp.me/ns#',
				itemscope: true,
				itemtype: 'https://schema.org/WebSite',
			},
			{ kind: 'title', content: 'Example' },
		];
		const meta = classify(raw);
		expect(meta.title).toBe('Example');
		expect(meta.lang).toBe('ja');
		expect(meta.dir).toBe('ltr');
		expect(meta.prefix).toBe('og: https://ogp.me/ns#');
		expect(meta.rdfa?.prefix).toBe('og: https://ogp.me/ns#');
		expect(meta.itemType).toBe('https://schema.org/WebSite');
		expect(meta.microdata?.itemscope).toBe(true);
	});

	it('routes meta name="description" and meta property="og:image"', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'description', content: 'Page desc' },
			{ kind: 'meta', property: 'og:image', content: 'https://x.test/a.png' },
			{ kind: 'meta', property: 'og:image', content: 'https://x.test/b.png' },
		];
		const meta = classify(raw);
		expect(meta.description).toBe('Page desc');
		expect(meta.og?.image).toEqual(['https://x.test/a.png', 'https://x.test/b.png']);
	});

	it('parses viewport meta', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'viewport', content: 'width=device-width, initial-scale=1' },
		];
		const meta = classify(raw);
		expect(meta.viewport?.width).toBe('device-width');
		expect(meta.viewport?.initialScale).toBe(1);
	});

	it('parses robots meta with mixed flags and directives', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'robots', content: 'noindex, max-snippet:30' },
		];
		const meta = classify(raw);
		expect(meta.robots?.noindex).toBe(true);
		expect(meta.robots?.maxSnippet).toBe(30);
	});

	it('routes theme-color by media attribute', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'theme-color', content: '#fff' },
			{
				kind: 'meta',
				name: 'theme-color',
				content: '#000',
				media: '(prefers-color-scheme: dark)',
			},
			{
				kind: 'meta',
				name: 'theme-color',
				content: '#eee',
				media: '(prefers-color-scheme: light)',
			},
		];
		const meta = classify(raw);
		expect(meta.themeColor).toBe('#fff');
		expect(meta.themeColorDark).toBe('#000');
		expect(meta.themeColorLight).toBe('#eee');
	});

	it('parses http-equiv refresh', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', httpEquiv: 'refresh', content: '5; url=https://example.com/' },
		];
		const meta = classify(raw);
		expect(meta.httpEquiv?.refresh?.seconds).toBe(5);
		expect(meta.httpEquiv?.refresh?.url).toBe('https://example.com/');
	});

	it('routes canonical link to Meta.link.canonical', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'link', rel: ['canonical'], href: 'https://example.com/' },
		];
		const meta = classify(raw);
		expect(meta.link?.canonical).toBe('https://example.com/');
	});

	it('routes alternate rss feed by type', () => {
		const raw: RawHeadEntry[] = [
			{
				kind: 'link',
				rel: ['alternate'],
				href: '/feed.xml',
				type: 'application/rss+xml',
				title: 'RSS',
			},
		];
		const meta = classify(raw);
		expect(meta.link?.alternateRss).toHaveLength(1);
		expect(meta.link?.alternateRss[0]?.title).toBe('RSS');
	});

	it('refines icon by sizes/type', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'link', rel: ['icon'], href: '/icon.svg', type: 'image/svg+xml' },
			{ kind: 'link', rel: ['icon'], href: '/icon.ico' },
			{ kind: 'link', rel: ['icon'], href: '/icon-32.png', sizes: '32x32' },
			{ kind: 'link', rel: ['icon'], href: '/icon-any.png', sizes: 'any' },
		];
		const meta = classify(raw);
		expect(meta.link?.iconSvg?.href).toBe('/icon.svg');
		expect(meta.link?.icon?.href).toBe('/icon.ico');
		expect(meta.link?.iconSized).toHaveLength(1);
		expect(meta.link?.iconAny?.href).toBe('/icon-any.png');
	});

	it('refines apple-touch-icon by sizes', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'link', rel: ['apple-touch-icon'], href: '/apple-touch-icon.png' },
			{
				kind: 'link',
				rel: ['apple-touch-icon'],
				href: '/apple-touch-icon-180.png',
				sizes: '180x180',
			},
		];
		const meta = classify(raw);
		expect(meta.link?.appleTouchIcon?.href).toBe('/apple-touch-icon.png');
		expect(meta.link?.appleTouchIconSized).toHaveLength(1);
	});

	it('preserves unknown meta name in others.meta', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'x-d-zero-custom', content: 'value-a' },
			{ kind: 'meta', name: 'x-d-zero-custom', content: 'value-b' },
		];
		const meta = classify(raw);
		expect(meta.others.meta['x-d-zero-custom']).toEqual(['value-a', 'value-b']);
	});

	it('preserves unknown link rel in others.link', () => {
		const raw: RawHeadEntry[] = [{ kind: 'link', rel: ['some-future-rel'], href: '/x' }];
		const meta = classify(raw);
		expect(meta.others.link).toHaveLength(1);
		expect(meta.others.link[0]?.href).toBe('/x');
	});

	it('parses application/ld+json into jsonLd', () => {
		const raw: RawHeadEntry[] = [
			{
				kind: 'script',
				scriptType: 'application/ld+json',
				content: '{"@type":"WebSite","name":"X"}',
				location: 'head',
			},
		];
		const meta = classify(raw);
		expect(meta.jsonLd).toHaveLength(1);
		expect(meta.jsonLd[0]?.parsed).toEqual({ '@type': 'WebSite', name: 'X' });
	});

	it('records jsonLd parseError on invalid JSON', () => {
		const raw: RawHeadEntry[] = [
			{
				kind: 'script',
				scriptType: 'application/ld+json',
				content: '{not valid',
				location: 'head',
			},
		];
		const meta = classify(raw);
		expect(meta.jsonLd).toHaveLength(1);
		expect(meta.jsonLd[0]?.parseError).toBeDefined();
	});

	it('captures iframes into others.iframe', () => {
		const raw: RawHeadEntry[] = [
			{
				kind: 'iframe',
				src: 'https://www.googletagmanager.com/ns.html?id=GTM-XYZ',
				location: 'noscript',
			},
		];
		const meta = classify(raw);
		expect(meta.others.iframe).toHaveLength(1);
		expect(meta.others.iframe[0]?.location).toBe('noscript');
	});

	it('writes cross-reference paths: msapplication-config goes to both', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'msapplication-config', content: '/browserconfig.xml' },
		];
		const meta = classify(raw);
		expect(meta.msapplication?.config).toBe('/browserconfig.xml');
		expect(meta.msapplication?.configFile).toBe('/browserconfig.xml');
	});

	it('writes verification.google for google-site-verification', () => {
		const raw: RawHeadEntry[] = [
			{ kind: 'meta', name: 'google-site-verification', content: 'abc123' },
		];
		const meta = classify(raw);
		expect(meta.verification?.google).toBe('abc123');
	});

	it('honors `includeRaw` option', () => {
		const raw: RawHeadEntry[] = [{ kind: 'title', content: 'X' }];
		const meta = classify(raw, { includeRaw: true });
		expect(meta._raw).toBe(raw);
	});

	it('integrates external tags option', () => {
		const meta = classify([], {
			tags: {
				detected: { Analytics: { 'Google Analytics': { ids: ['G-1'] } } },
				entries: [
					{
						provider: 'Google Analytics',
						categories: ['Analytics'],
						id: 'G-1',
						sources: [{ type: 'html' }],
					},
				],
			},
		});
		expect(meta.tags.detected.Analytics?.['Google Analytics']?.ids).toEqual(['G-1']);
		expect(meta.tags.entries).toHaveLength(1);
	});
});
