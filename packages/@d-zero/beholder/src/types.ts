/**
 * Beholder type definitions for the page-level scraper.
 * @see {@link ./scraper.ts} for the Scraper class that produces these types
 * @see {@link ./dom-evaluation.ts} for DOM extraction functions (anchors, images, meta)
 * @module
 */

export type { ExURL, ParseURLOptions } from '@d-zero/shared/parse-url';
export type { CompressType } from '@d-zero/shared/detect-compress';
export type { CDNType } from '@d-zero/shared/detect-cdn';

import type { CDNType } from '@d-zero/shared/detect-cdn';
import type { CompressType } from '@d-zero/shared/detect-compress';
import type { ExURL } from '@d-zero/shared/parse-url';

/**
 * Scraped page data returned by the scraper after successfully processing a page.
 */
export type PageData = {
	/** The parsed URL of the page. */
	url: ExURL;

	/** Chain of redirect URLs traversed to reach the final destination. */
	redirectPaths: string[];

	/** Whether this page is a target page (internal and within the crawl scope). */
	isTarget: boolean;

	/** Whether this page is external to the crawl scope. */
	isExternal: boolean;

	/** HTTP status code of the response. */
	status: number;

	/** HTTP status text of the response. */
	statusText: string;

	/** The Content-Type header value, or `null` if unavailable. */
	contentType: string | null;

	/** The Content-Length header value in bytes, or `null` if unavailable. */
	contentLength: number | null;

	/** Raw HTTP response headers, or `null` if unavailable. */
	responseHeaders: Record<string, string | string[] | undefined> | null;

	/** Extracted metadata from the page (title, description, OGP, etc.). */
	meta: Meta;

	/** List of anchor elements found on the page. */
	anchorList: AnchorData[];

	/** List of image elements found on the page. */
	imageList: ImageElement[];

	/** HTML snapshot of the rendered DOM. */
	html: string;

	/** Always `false` for successfully scraped pages. See {@link SkippedPageData} for skipped pages. */
	isSkipped: false;
};

/**
 * Information about an image element found on a page.
 */
export type ImageElement = {
	/** The `src` attribute value of the image element. */
	src: string;

	/** The `currentSrc` property value (the actual URL loaded by the browser). */
	currentSrc: string;

	/** The `alt` attribute value of the image element. */
	alt: string;

	/** The CSS layout width of the image in pixels. */
	width: number;

	/** The CSS layout height of the image in pixels. */
	height: number;

	/** The intrinsic width of the image in pixels. */
	naturalWidth: number;

	/** The intrinsic height of the image in pixels. */
	naturalHeight: number;

	/** Whether the image uses lazy loading (`loading="lazy"` or IntersectionObserver). */
	isLazy: boolean;

	/** The viewport width at which this image was captured. */
	viewportWidth: number;

	/** The outer HTML source code of the image element. */
	sourceCode: string;
};

/**
 * Data for a page that was skipped during crawling due to keyword or path exclusion.
 */
export type SkippedPageData = {
	/** Always `true` for skipped pages. */
	isSkipped: true;

	/** The URL of the skipped page. */
	url: ExURL;

	/** The reason the page was skipped, with match details. */
	matched:
		| {
				/** Skipped due to a keyword match in the page content. */
				type: 'keyword';
				/** The text that matched the exclusion keyword. */
				text: string;
				/** The exclusion keywords that triggered the skip. */
				excludeKeywords: string[];
		  }
		| {
				/** Skipped due to a URL path pattern match. */
				type: 'path';
				/** The exclusion patterns that triggered the skip. */
				excludes: string[];
		  };
};

/**
 * A network resource (CSS, JS, image, etc.) captured during page scraping.
 */
export type Resource = {
	/** The URL of the resource. */
	url: ExURL;

	/** Whether the resource is from an external domain. */
	isExternal: boolean;

	/** Whether the resource request resulted in an error. */
	isError: boolean;

	/** HTTP status code, or `null` if the request failed. */
	status: number | null;

	/** HTTP status text, or `null` if the request failed. */
	statusText: string | null;

	/** The Content-Type header value, or `null` if unavailable. */
	contentType: string | null;

	/** The Content-Length header value in bytes, or `null` if unavailable. */
	contentLength: number | null;

	/** The compression algorithm used, or `false` if uncompressed. */
	compress: false | CompressType;

	/** The CDN provider detected from response headers, or `false` if none detected. */
	cdn: false | CDNType;

	/** Raw HTTP response headers, or `null` if unavailable. */
	headers: Record<string, string | string[] | undefined> | null;
};

/**
 * Data extracted from an anchor element (`<a>` or `<area>`) on a page.
 */
export type AnchorData = {
	/**
	 * Extracts the value of the `href` attribute from anchor element (`<a>` `<area>`)
	 */
	href: ExURL;

	/**
	 * The accessible name of the anchor element
	 */
	textContent: string;

	/**
	 * Whether the anchor points to an external URL.
	 * Set by `processAnchors()` in the crawler; not available in the sub-process.
	 */
	isExternal?: boolean;
};

/**
 * Metadata extracted from a page's `<head>` element.
 */
export type Meta = {
	/** The `lang` attribute of the `<html>` element. */
	lang?: string;

	/** The text content of the `<title>` element. */
	title: string;

	/** The `content` attribute of `<meta name="description">`. */
	description?: string;

	/** The `content` attribute of `<meta name="keywords">`. */
	keywords?: string;

	/** Whether `noindex` is present in the robots meta tag. */
	noindex?: boolean;

	/** Whether `nofollow` is present in the robots meta tag. */
	nofollow?: boolean;

	/** Whether `noarchive` is present in the robots meta tag. */
	noarchive?: boolean;

	/** The canonical URL from `<link rel="canonical">`. */
	canonical?: string;

	/** The alternate URL from `<link rel="alternate">`. */
	alternate?: string;

	/** The Open Graph type (`og:type`). */
	'og:type'?: string;

	/** The Open Graph title (`og:title`). */
	'og:title'?: string;

	/** The Open Graph site name (`og:site_name`). */
	'og:site_name'?: string;

	/** The Open Graph description (`og:description`). */
	'og:description'?: string;

	/** The Open Graph URL (`og:url`). */
	'og:url'?: string;

	/** The Open Graph image URL (`og:image`). */
	'og:image'?: string;

	/** The Twitter Card type (`twitter:card`). */
	'twitter:card'?: string;
};

/**
 * A network request/response log entry captured during page scraping via Puppeteer.
 */
export type NetworkLog = {
	/** The URL of the network request. */
	url: ExURL;

	/** HTTP status code of the response, or `null` if the request failed. */
	status: number | null;

	/** The Content-Length of the response body in bytes. */
	contentLength: number;

	/** The Content-Type of the response. */
	contentType: string;

	/** Whether the request resulted in an error. */
	isError: boolean;

	/** Details of the outgoing HTTP request. */
	request: {
		/** Timestamp of the request in milliseconds. */
		ts: number;
		/** HTTP request headers. */
		headers: Record<string, string>;
		/** HTTP method used (e.g., "GET", "POST"). */
		method: string;
	};

	/** Details of the HTTP response, absent if the request failed. */
	response?: {
		/** Timestamp of the response in milliseconds. */
		ts: number;
		/** HTTP status code. */
		status: number;
		/** HTTP status text. */
		statusText: string;
		/** Whether the response was served from cache. */
		fromCache: boolean;
		/** HTTP response headers. */
		headers: Record<string, string>;
	};
};

/**
 * The result of a single page scrape operation.
 * Encapsulates the outcome and all captured sub-resources.
 */
export type ScrapeResult = {
	/**
	 * The type of result:
	 * - `"success"` - Scraping completed successfully.
	 * - `"skipped"` - The page was skipped due to an exclusion rule.
	 * - `"error"` - An error occurred during scraping.
	 */
	type: 'success' | 'skipped' | 'error';
	/** The full page data, present when `type` is `"success"`. */
	pageData?: PageData;
	/** All sub-resources captured during the page load. */
	resources: ResourceEntry[];
	/** Details about why the page was ignored, present when `type` is `"skipped"`. */
	ignored?: { url: ExURL; matchedText: string; excludeKeywords: string[] };
	/** Error details, present when `type` is `"error"`. */
	error?: { name: string; message: string; stack?: string; shutdown: boolean };
	/** Sub-resource requests that failed during page loading (e.g., due to network disconnection). */
	failedRequests?: ReadonlyArray<{ url: string; errorText: string }>;
};

/**
 * A single sub-resource entry captured during page scraping.
 * Represents one network resource (CSS, JS, image, etc.) loaded by a page.
 */
export type ResourceEntry = {
	/** The network log entry containing request/response timing and headers. */
	log: NetworkLog;
	/** The resource metadata (without UID, which is assigned by the archive layer). */
	resource: Omit<Resource, 'uid'>;
	/** The URL (without hash) of the page that triggered this resource load. */
	pageUrl: string;
};

/**
 * Event payload describing a phase transition in the scraping lifecycle.
 * Phases proceed roughly in order: scrapeStart -> openPage ->
 * loadDOMContent -> waitNetworkIdle -> getHTML -> getAnchors -> getMeta ->
 * extractImages -> getImages -> scrapeEnd.
 */
export type ChangePhaseEvent = {
	/** The process ID of the scraper worker. */
	pid: number;
	/**
	 * The name of the current scraping phase.
	 *
	 * - `scrapeStart` - Scraping has begun for a URL.
	 * - `launchBrowser` - A browser instance is being launched.
	 * - `headRequest` - Performing an HTTP HEAD request to check the destination.
	 * - `headRequestTimeout` - The HEAD request timed out.
	 * - `newPage` - A new browser page/tab is being created.
	 * - `openPage` - Navigating the browser page to the target URL.
	 * - `loadDOMContent` - Waiting for the DOM content to finish loading.
	 * - `waitNetworkIdle` - Waiting for all network activity to cease.
	 * - `getHTML` - Extracting the page HTML content.
	 * - `setViewport` - Setting the browser viewport dimensions.
	 * - `scrollToBottom` - Scrolling the page to trigger lazy-loaded content.
	 * - `extractImages` - Starting the image extraction pipeline.
	 * - `waitImageLoad` - Waiting for images to finish loading on the page.
	 * - `getImages` - Extracting image element data from the page.
	 * - `getAnchors` - Extracting anchor/link data from the page.
	 * - `getMeta` - Extracting meta tag information from the page.
	 * - `pageSkipped` - The page matched an exclusion rule and is being skipped.
	 * - `retryWait` - Waiting before a retry attempt after a transient failure.
	 * - `retryExhausted` - All retry attempts exhausted; giving up on this operation.
	 * - `scrapeEnd` - Scraping has completed for this URL.
	 * - `beforeCleanup` - The scraper is about to clean up resources.
	 * - `cleanedUp` - The scraper has finished cleaning up.
	 */
	name:
		| 'scrapeStart'
		| 'launchBrowser'
		| 'headRequest'
		| 'headRequestTimeout'
		| 'newPage'
		| 'openPage'
		| 'loadDOMContent'
		| 'waitNetworkIdle'
		| 'getHTML'
		| 'setViewport'
		| 'scrollToBottom'
		| 'extractImages'
		| 'waitImageLoad'
		| 'getImages'
		| 'getAnchors'
		| 'getMeta'
		| 'pageSkipped'
		| 'retryWait'
		| 'retryExhausted'
		| 'scrapeEnd'
		| 'beforeCleanup'
		| 'cleanedUp';
	/** The URL being scraped, or `null` when the phase is not URL-specific (e.g., setViewport). */
	url: ExURL | null;
	/** Whether the URL being scraped is external to the crawl scope. */
	isExternal: boolean;
	/** An optional human-readable message providing additional context about the phase. */
	message: string;
};

/**
 * Streaming event types emitted by the Scraper.
 * Result events (success, skipped, error) are returned as values,
 * not emitted as events.
 */
export type ScraperEventTypes = {
	/**
	 * Emitted when a sub-resource response is captured during page loading.
	 * Only fires for internal (non-external) pages.
	 */
	resourceResponse: {
		/** The process ID of the scraper worker. */
		pid: number;
		/** The URL of the page being scraped. */
		url: ExURL;
		/** Network log entry for the resource request/response. */
		log: NetworkLog;
		/** The resource metadata (without UID, which is assigned later by the archive). */
		resource: Omit<Resource, 'uid'>;
	};
	/**
	 * Emitted when the scraper transitions between lifecycle phases.
	 */
	changePhase: ChangePhaseEvent;
};

/**
 * Configuration options for the Scraper.
 */
export type ScraperOptions = {
	/** Whether the URL is external to the crawl scope. */
	isExternal: boolean;
	/** Whether to capture image element data from the page. */
	captureImages: boolean;
	/** Keywords or patterns that, if found in the page HTML, cause the page to be skipped. */
	excludeKeywords: string[];
	/** When `true`, only metadata is fetched (via HEAD request) without full browser scraping. */
	metadataOnly: boolean;
	/** Timeout in ms for waiting lazy-loaded images to finish loading. Defaults to 5000. */
	imageLoadTimeout: number;
	/** When `true`, query parameters are stripped from URLs during parsing. */
	disableQueries: boolean;
	/** Number of retries for network operations. Overrides `@retryable` default. */
	retries?: number;
	/** Pre-fetched HEAD check result. When provided, scrapeStart() skips the HEAD request. */
	headCheckResult?: PageData;
	/** Timeout (ms) for page.goto(). Default: 60_000 (60s). */
	navigationTimeout?: number;
	/**
	 * Timeout (ms) for DOM evaluation operations (meta/image/anchor extraction).
	 * Bounds how long extraction may hang on a page with an unresponsive main thread.
	 * Default: 180_000 (180s, aligned with the upstream retryable timeout).
	 */
	domEvaluationTimeout?: number;
};
