import type { Page } from 'puppeteer';

/**
 * Best-effort wait until the page has no more than `concurrency` in-flight
 * network connections for `idleTime` ms, or until `timeout` elapses. Always
 * fulfills — including when `waitForNetworkIdle` rejects — so callers can
 * continue to HTML / anchors / meta.
 *
 * WHY not `page.waitForNavigation({ waitUntil: 'networkidle0' })` after
 * `page.goto()`: `waitForNavigation` waits for a *future* navigation. On a
 * page that has already settled, it always burns the full timeout. Use
 * `waitForNetworkIdle` for "network has quieted on the current page"
 * (https://pptr.dev/api/puppeteer.page.waitfornetworkidle).
 *
 * WHY swallow every rejection (not only timeout): Callers still want an HTML
 * snapshot / anchors / meta when analytics beacons, polling, or a closed
 * target keep idle from resolving. A hard failure would drop the whole page;
 * proceeding after the wait attempt matches the historical scrape contract
 * (best-effort settle, then continue).
 *
 * WHY these defaults: `concurrency: 0` matches Puppeteer's former
 * `networkidle0`; `idleTime: 500` is Puppeteer's default quiet window;
 * `timeout: 5000` caps wait per page so a chatty site cannot stall the crawl.
 * @param page - Puppeteer page whose in-flight requests are observed
 * @example
 * ```ts
 * await awaitPageNetworkIdle(page);
 * const html = await page.evaluate(() => document.documentElement.outerHTML);
 * ```
 */
export async function awaitPageNetworkIdle(page: Page): Promise<void> {
	await page
		.waitForNetworkIdle({ idleTime: 500, concurrency: 0, timeout: 5000 })
		.catch(() => {});
}
