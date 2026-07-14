/**
 * Reads the host (not the full origin — see `filterFirstPartyStylesheetHrefs`'s
 * JSDoc for why) out of `href`, or `undefined` if it isn't a parseable
 * absolute URL. `stylesheetHrefs` is already expected to be absolute (see
 * {@link ./derive-stylesheet-group-key.js | deriveStylesheetGroupKey}'s own
 * JSDoc) — this is defensive, not a normalization step.
 * @param href
 */
function tryGetHost(href: string): string | undefined {
	try {
		return new URL(href).host;
	} catch {
		return undefined;
	}
}

/**
 * Narrows every page's `stylesheetHrefs` down to just the hrefs whose host
 * matches that page's own `host` field (direct comparison), when the caller
 * provides it. Falls back to the single most common host across the whole
 * batch (the site's own first-party domain, inferred rather than given) for
 * any page that omits `host` — see this function's own JSDoc further down
 * for that fallback's known limitations.
 *
 * Confirmed on real crawl data (302 pages): a handful of articles embedding
 * a YouTube video pulled in `youtube.com`'s own player stylesheet plus a
 * per-embed tracking URL that resembles a stylesheet reference; other
 * articles embedding a particular widget pulled in two extra
 * `fonts.googleapis.com` URLs beyond the site's usual one. Both are
 * incidental to whatever third-party content a page happens to embed, not
 * evidence of which template the page uses — but
 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}'s
 * document-frequency filtering has no way to tell "rare because it's a
 * genuinely distinctive template" apart from "rare because almost no other
 * page happens to embed this same third party," so it let these through as
 * if they were real template signals, splitting a handful of otherwise-
 * identical pages (confirmed via direct comparison: 100% token overlap with
 * their section's main cluster) away from where they belonged. Filtering to
 * first-party hrefs before blocking removes that false signal at the
 * source, rather than trying to recognize its effects downstream.
 *
 * `host`, when provided, is compared directly against each of that page's
 * own stylesheet hrefs — no batch-wide inference involved, so this path
 * cannot mistake a third party for the first party regardless of how many
 * pages happen to also embed it. Added after a real crawl (302 pages) hit
 * the dominant-host fallback's tie case: every single page loaded both its
 * own first-party stylesheet *and* the same `fonts.googleapis.com` webfont
 * request (a common sitewide pattern, not a rare misconfiguration), so both
 * hosts tied at "referenced by 100% of pages" and the fallback's `>`-only
 * tie-break (see below) picked whichever host happened to be counted first
 * — silently the wrong one on that crawl. A caller that already knows each
 * page's own host (e.g. it has the page's URL on hand, as most crawlers do)
 * should always provide it; the inferred fallback exists only for callers
 * that don't have that information available.
 *
 * The dominant-host fallback (used per-page whenever that page omits `host`)
 * determines "first-party" from the batch's own href distribution instead
 * — comparing each href's host against each page's own URL wasn't possible
 * for callers that only ever had `stylesheetHrefs` on hand, not full page
 * URLs (this is still true for anything built directly on
 * {@link ./resolve-blocking-group-keys.js | resolveBlockingGroupKeys}'s
 * `PageBlockingSignals`, which never carried a host field until this
 * `host` option was added). It inherits `resolveBlockingGroupKeys`'s own
 * "roughly homogeneous batch" precondition (see `computeDocumentFrequency`'s
 * own JSDoc): a batch that mixes pages from more than one site in one call
 * has no single genuine first-party host to find, and this function has no
 * way to detect that it's been handed one — it will still confidently pick
 * a* dominant host (whichever site contributes more stylesheet-bearing
 * pages) and silently strip every other site's real first-party hrefs.
 * Splitting a multi-site/section batch into homogeneous groups before
 * calling this (or simply providing `host` per page) is the caller's
 * responsibility, same as it already is for `resolveBlockingGroupKeys`.
 *
 * The dominant host is picked by how many *pages* reference it at least
 * once, not by how many stylesheet `<link>` tags reference it — a page
 * loading one first-party stylesheet plus two third-party font requests
 * must not let the font host outvote the actual first-party one just for
 * appearing on more `<link>` tags. Compared by `host` (hostname + port),
 * not the full origin (which also includes the scheme): the same first-party
 * site served over both `http:` and `https:` (mid-migration, or a stray
 * unresolved protocol-relative URL) is still one site, not two competing
 * "hosts" splitting its own vote.
 *
 * The fallback's remaining trade-offs: a site that legitimately serves its
 * own stylesheets from more than one first-party host (e.g. a CDN subdomain
 * alongside the main domain) will have its non-dominant host's hrefs
 * dropped too, same as any genuinely-third-party host; and a tie between
 * two equally-common hosts silently keeps whichever was counted first
 * (confirmed above to include real, common sitewide third parties, not
 * just a theoretical edge case) — both are avoided entirely by providing
 * `host`.
 *
 * A page with neither a provided `host` nor any batch-wide dominant host to
 * fall back on (no page in the batch has any parseable stylesheet href at
 * all) has its `stylesheetHrefs` returned unchanged, matching this
 * function's job of narrowing signal, not fabricating it.
 * @param pages
 * @example
 * ```ts
 * // Without `host`: falls back to dominant-host inference (ties possible).
 * filterFirstPartyStylesheetHrefs([
 * 	{ stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/b.css'] },
 * 	{ stylesheetHrefs: ['https://example.com/a.css', 'https://fonts.googleapis.com/css?family=x'] },
 * ]);
 * // [
 * // 	{ stylesheetHrefs: ['https://example.com/a.css', 'https://example.com/b.css'] },
 * // 	{ stylesheetHrefs: ['https://example.com/a.css'] }, // fonts.googleapis.com dropped
 * // ]
 *
 * // With `host`: direct per-page comparison, immune to ties.
 * filterFirstPartyStylesheetHrefs([
 * 	{
 * 		host: 'example.com',
 * 		stylesheetHrefs: ['https://example.com/a.css', 'https://fonts.googleapis.com/css?family=x'],
 * 	},
 * ]);
 * // [{ host: 'example.com', stylesheetHrefs: ['https://example.com/a.css'] }]
 * ```
 */
export function filterFirstPartyStylesheetHrefs<
	T extends { stylesheetHrefs: readonly string[]; host?: string },
>(pages: readonly T[]): T[] {
	const pageHrefHosts = pages.map((page) => ({
		page,
		hrefHosts: page.stylesheetHrefs.map((href) => ({ href, host: tryGetHost(href) })),
	}));

	const hostPageCounts = new Map<string, number>();
	for (const { hrefHosts } of pageHrefHosts) {
		const distinctHosts = new Set(
			hrefHosts
				.map(({ host }) => host)
				.filter((host): host is string => host !== undefined),
		);
		for (const host of distinctHosts) {
			hostPageCounts.set(host, (hostPageCounts.get(host) ?? 0) + 1);
		}
	}

	let dominantHost: string | undefined;
	let dominantCount = 0;
	for (const [host, count] of hostPageCounts) {
		if (count > dominantCount) {
			dominantHost = host;
			dominantCount = count;
		}
	}

	return pageHrefHosts.map(({ page, hrefHosts }) => {
		// A page that supplies its own host is judged against that host
		// alone, bypassing the batch-wide dominant-host inference (and its
		// tie-breaking pitfall) entirely — see this function's own JSDoc.
		const expectedHost = page.host ?? dominantHost;
		if (expectedHost === undefined) {
			return { ...page };
		}
		return {
			...page,
			stylesheetHrefs: hrefHosts
				.filter(({ host }) => host === expectedHost)
				.map(({ href }) => href),
		};
	});
}
