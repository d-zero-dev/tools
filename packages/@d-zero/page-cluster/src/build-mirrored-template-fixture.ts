import type { PageClusterSignals } from './resolve-page-cluster-keys.js';

/**
 * One entry in {@link MODULE_POOL}: renders a CMS-style content block given a
 * repeat count (used to vary a page's size across the fixture without
 * changing its template identity).
 */
type ModuleRenderer = (repeatCount: number) => string;

/**
 * @param count
 * @param render
 */
function repeatMarkup(count: number, render: (index: number) => string): string {
	let out = '';
	for (let i = 0; i < count; i++) out += render(i);
	return out;
}

/**
 * Pool of CMS-style content blocks that {@link TEMPLATE_MODULES} composes
 * templates from. Modeled after real CMS "block" systems: templates share
 * modules with each other (a FAQ page and a contact page both use
 * `notice`/`contact`), which is what makes this fixture exercise Stage B's
 * cross-block containment/shape logic instead of trivially disjoint token
 * sets.
 */
const MODULE_POOL: Readonly<Record<string, ModuleRenderer>> = {
	lead: () =>
		`<div class="mod-lead"><p class="mod-lead__text">x</p><p class="mod-lead__note">n</p></div>`,
	heading: () =>
		`<div class="mod-heading"><h2 class="mod-heading__ttl">h</h2><p class="mod-heading__sub">s</p></div>`,
	photo: () =>
		`<figure class="mod-photo"><img class="mod-photo__img" src="p.jpg"><figcaption class="mod-photo__cap">c</figcaption></figure>`,
	table: (n) =>
		`<div class="mod-table"><table class="mod-table__table"><thead><tr><th class="mod-table__th">h</th></tr></thead><tbody>${repeatMarkup(
			n,
			(i) => `<tr class="mod-table__tr"><td class="mod-table__td">v${i}</td></tr>`,
		)}</tbody></table></div>`,
	accordion: (n) =>
		`<div class="mod-accordion">${repeatMarkup(
			n,
			(i) =>
				`<dl class="mod-accordion__item"><dt class="mod-accordion__q"><button class="mod-accordion__toggle">q${i}</button></dt><dd class="mod-accordion__a"><p class="mod-accordion__text">a${i}</p></dd></dl>`,
		)}</div>`,
	cards: (n) =>
		`<ul class="mod-cards">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-cards__item"><a class="mod-cards__link" href="#${i}"><span class="mod-cards__fig"><img class="mod-cards__img" src="c.jpg"></span><span class="mod-cards__ttl">c${i}</span></a></li>`,
		)}</ul>`,
	steps: (n) =>
		`<ol class="mod-steps">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-steps__item"><span class="mod-steps__num">${i}</span><h3 class="mod-steps__ttl">s${i}</h3><p class="mod-steps__text">d${i}</p></li>`,
		)}</ol>`,
	map: () =>
		`<div class="mod-map"><iframe class="mod-map__frame" src="map"></iframe><p class="mod-map__note">m</p></div>`,
	deflist: (n) =>
		`<dl class="mod-deflist">${repeatMarkup(
			n,
			(i) =>
				`<dt class="mod-deflist__dt">d${i}</dt><dd class="mod-deflist__dd">v${i}</dd>`,
		)}</dl>`,
	gallery: (n) =>
		`<ul class="mod-gallery">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-gallery__item"><figure class="mod-gallery__fig"><img class="mod-gallery__img" src="g.jpg"><figcaption class="mod-gallery__cap">g${i}</figcaption></figure></li>`,
		)}</ul>`,
	form: (n) =>
		`<form class="mod-form" action="#">${repeatMarkup(
			n,
			(i) =>
				`<div class="mod-form__row"><label class="mod-form__label">l${i}</label><input class="mod-form__input"></div>`,
		)}<button class="mod-form__submit">go</button></form>`,
	notice: () =>
		`<div class="mod-notice"><p class="mod-notice__text">n</p><a class="mod-notice__link" href="#">more</a></div>`,
	timetable: (n) =>
		`<div class="mod-timetable"><table class="mod-timetable__table"><tbody>${repeatMarkup(
			n,
			(i) =>
				`<tr class="mod-timetable__tr"><td class="mod-timetable__time">t${i}</td><td class="mod-timetable__dest">d${i}</td></tr>`,
		)}</tbody></table></div>`,
	price: (n) =>
		`<div class="mod-price"><ul class="mod-price__list">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-price__item"><span class="mod-price__name">n${i}</span><span class="mod-price__yen">y${i}</span></li>`,
		)}</ul></div>`,
	banner: () =>
		`<div class="mod-banner"><a class="mod-banner__link" href="#"><img class="mod-banner__img" src="b.jpg"></a></div>`,
	video: () =>
		`<div class="mod-video"><video class="mod-video__el" src="v.mp4"></video></div>`,
	tabs: (n) =>
		`<div class="mod-tabs"><ul class="mod-tabs__nav">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-tabs__navitem"><button class="mod-tabs__btn">t${i}</button></li>`,
		)}</ul><div class="mod-tabs__panel"><p class="mod-tabs__text">p</p></div></div>`,
	download: (n) =>
		`<ul class="mod-download">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-download__item"><a class="mod-download__link" href="f${i}.pdf"><span class="mod-download__icon"></span><span class="mod-download__name">f${i}</span></a></li>`,
		)}</ul>`,
	contact: () =>
		`<div class="mod-contact"><p class="mod-contact__tel">tel</p><p class="mod-contact__hours">h</p><a class="mod-contact__mail" href="#">m</a></div>`,
	anchorlinks: (n) =>
		`<nav class="mod-anchor"><ul class="mod-anchor__list">${repeatMarkup(
			n,
			(i) =>
				`<li class="mod-anchor__item"><a class="mod-anchor__link" href="#a${i}">a${i}</a></li>`,
		)}</ul></nav>`,
};

/**
 * Templates as ordered subsets of {@link MODULE_POOL}, modeling how real CMS
 * templates share some blocks and differ in others.
 */
const TEMPLATE_MODULES: Readonly<Record<string, readonly string[]>> = {
	faq: ['heading', 'anchorlinks', 'accordion', 'notice', 'contact'],
	course: ['heading', 'photo', 'steps', 'map', 'deflist', 'notice'],
	index: ['heading', 'lead', 'cards', 'banner', 'notice'],
	fare: ['heading', 'lead', 'price', 'table', 'notice', 'contact'],
	article: ['heading', 'lead', 'photo', 'deflist', 'download'],
	gallery: ['heading', 'gallery', 'video', 'banner'],
	search: ['heading', 'form', 'tabs', 'notice'],
	access: ['heading', 'map', 'timetable', 'deflist', 'contact'],
};

/**
 * @param n
 * @param render
 */
function times(n: number, render: (i: number) => string): string {
	let out = '';
	for (let i = 0; i < n; i++) out += render(i);
	return out;
}

const HEADER = `<header class="site-header"><div class="site-header__inner"><p class="site-logo"><a class="site-logo__link" href="/"><img class="site-logo__img" src="logo.svg"></a></p><nav class="gnav"><ul class="gnav__list">${times(
	8,
	(i) => `<li class="gnav__item"><a class="gnav__link" href="/s${i}/">n${i}</a></li>`,
)}</ul></nav><div class="site-header__util"><a class="site-header__lang" href="#">lang</a></div></div></header>`;

const FOOTER = `<footer class="site-footer"><div class="site-footer__inner"><nav class="fnav"><ul class="fnav__list">${times(
	10,
	(i) => `<li class="fnav__item"><a class="fnav__link" href="/f${i}/">f${i}</a></li>`,
)}</ul></nav><p class="site-copyright">c</p></div></footer>`;

const BREADCRUMB = `<nav class="breadcrumb"><ol class="breadcrumb__list">${times(
	3,
	(i) =>
		`<li class="breadcrumb__item"><a class="breadcrumb__link" href="/b${i}/">b${i}</a></li>`,
)}</ol></nav>`;
const PAGE_HEAD = `<div class="page-head"><div class="page-head__inner"><h1 class="page-head__ttl">t</h1><p class="page-head__lead">l</p></div></div>`;
const RELATED = `<aside class="related"><h2 class="related__ttl">r</h2><ul class="related__list">${times(
	4,
	(i) =>
		`<li class="related__item"><a class="related__link" href="/r${i}/">r${i}</a></li>`,
)}</ul></aside>`;

/**
 * Options for {@link buildMirroredTemplateFixture}.
 */
export type MirroredTemplateFixtureOptions = {
	/**
	 * URL segment values a whole section is mirrored under (e.g. language
	 * codes). Each value gets its own copy of every template, at its own
	 * per-value stylesheet href — modeling a site that duplicates a section's
	 * CSS per mirror instead of sharing one file.
	 */
	readonly axisValues?: readonly string[];
	/** Pages generated per (template, axis value) pair. */
	readonly pagesPerTemplate?: number;
	/**
	 * Tag wrapping each page's content. `'main'` reproduces the L2-stage
	 * signature collapse this fixture exists to catch (see
	 * `merge-cross-block-clusters.ts`'s `l2Signature` JSDoc): every template's
	 * content sits under a `main > article > div > section > div` chain, so
	 * `l2Signature`'s class-stripped, 2-level-past-`main` truncation reduces
	 * every template to the same key set. `'div'` (or any other tag) opts out
	 * of `l2Signature`'s `main`-anchoring, so the fine stage alone must
	 * separate the templates correctly.
	 */
	readonly wrapperTag?: 'main' | 'div';
};

/**
 * One generated page's ground truth, alongside the `PageClusterSignals` a
 * clustering call actually sees. Tests assert against `template`/`axisValue`
 * rather than parsing them back out of a `clusterKey` string.
 */
export type MirroredTemplateFixturePage = {
	readonly signals: PageClusterSignals;
	readonly template: string;
	readonly axisValue: string;
	readonly page: number;
};

/**
 * Builds a synthetic multi-template, multi-mirror site: every template
 * shares a site-wide shell (header/gnav/footer) and shares
 * breadcrumb/page-head/related content blocks, and each template's own
 * content is a distinct ordered subset of a shared CMS module pool (see
 * {@link MODULE_POOL}) so templates partially overlap in tokens rather than
 * being trivially disjoint. Every template is duplicated once per
 * `axisValues` entry, each with its own per-mirror stylesheet href — this
 * shape collapses every template into one catch-all cluster when `main` is
 * the wrapper tag (a `main`-anchored wrapper chain degenerates
 * `l2Signature`), while the same site with content under a plain `<div>`
 * clusters correctly (see `wrapperTag`'s own JSDoc).
 * @param options
 * @example
 * ```ts
 * const { pages } = buildMirroredTemplateFixture({ wrapperTag: 'main' });
 * const keys = await resolvePageClusterKeysFromArray(pages.map((p) => p.signals));
 * // keys collapse to a single value — the bug this fixture reproduces
 * ```
 */
export function buildMirroredTemplateFixture(options?: MirroredTemplateFixtureOptions): {
	readonly pages: readonly MirroredTemplateFixturePage[];
	readonly templates: readonly string[];
} {
	const axisValues = options?.axisValues ?? ['en', 'zh', 'ko', 'th'];
	const pagesPerTemplate = options?.pagesPerTemplate ?? 6;
	const wrapperTag = options?.wrapperTag ?? 'main';

	const pages: MirroredTemplateFixturePage[] = [];
	for (const [template, moduleNames] of Object.entries(TEMPLATE_MODULES)) {
		for (const axisValue of axisValues) {
			for (let page = 0; page < pagesPerTemplate; page++) {
				// Every third page drops its last module — models conditional
				// rendering (an optional section) without changing the template.
				const mods = page % 3 === 2 ? moduleNames.slice(0, -1) : moduleNames;
				const body = mods
					.map(
						(m) =>
							`<div class="bg-base"><section class="sec sec--${m}"><div class="container">${MODULE_POOL[m]!(2 + (page % 3))}</div></section></div>`,
					)
					.join('');
				const inner = `<article>${PAGE_HEAD}${BREADCRUMB}${body}${RELATED}</article>`;
				const wrapped =
					wrapperTag === 'main'
						? `<main>${inner}</main>`
						: `<div class="main-area">${inner}</div>`;
				pages.push({
					template,
					axisValue,
					page,
					signals: {
						paths: [axisValue, template, `p${page}.html`],
						stylesheetHrefs: [
							'https://example.test/css/reset.css',
							'https://example.test/css/style.css',
							`https://example.test/${axisValue}/${template}/page.css`,
						],
						host: 'example.test',
						html: `<html><body>${HEADER}${wrapped}${FOOTER}</body></html>`,
					},
				});
			}
		}
	}

	return { pages, templates: Object.keys(TEMPLATE_MODULES) };
}
