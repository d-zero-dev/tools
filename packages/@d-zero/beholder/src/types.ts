import type { Action } from 'typescript-fsa';

export type ScrapeEvent = {
	pid: number | undefined;
	url: ExURL;
};

export type ScrapeErrorEvent = ScrapeEvent & {
	shutdown: boolean;
	error: {
		name: string;
		message: string;
		stack?: string;
	};
};

export type ScrapeEventTypes = {
	ignoreAndSkip: ScrapeEvent & {
		reason: {
			matchedText: string;
			excludeKeywords: string[];
		};
	};
	resourceResponse: ScrapeEvent & {
		log: NetworkLog;
		resource: Omit<Resource, 'uid'>;
	};
	scrapeEnd: ScrapeEvent & {
		timestamp: number;
		result: PageData;
	};
	destroyed: Omit<ScrapeEvent, 'url'>;
	error: ScrapeErrorEvent;
	changePhase: ChangePhaseEvent;
};

export type ChangePhaseEvent = {
	pid: number;
	name:
		| 'scrapeStart'
		| 'launchBrowser'
		| 'touchHead'
		| 'touchHeadTimeout'
		| 'newPage'
		| 'openPage'
		| 'loadDOMContent'
		| 'waitNetworkIdleZero'
		| 'getHTML'
		| 'setViewport'
		| 'scrollToBottom'
		| 'getImages'
		| 'getAnchors'
		| 'getMeta'
		| 'ignoreAndSkip'
		| 'scrapeEnd'
		| 'beforeDestroy'
		| 'destroyed';
	url: ExURL | null;
	isExternal: boolean;
	message: string;
};

export type AnyScrapeEvent = ScrapeEventTypes[keyof ScrapeEventTypes];

export type SubProcessEventTypes = {
	start: {
		url: ExURL;
		isExternal: boolean;
		isGettingImages: boolean;
		excludeKeywords: string[];
		executablePath: string | null;
		isSkip: boolean;
		isTitleOnly: boolean;
		screenshot: string | null;
	} & Required<ParseURLOptions>;
	destroy: void;
};

export type SubProcessEvent = {
	pid: number | undefined;
};

export type SubProcessChangeEvent =
	| ChangePhaseEvent
	| {
			pid: number | undefined;
			name: 'reset' | 'boot' | 'disconnect';
			url: ExURL | null;
			isExternal: boolean;
			message: string;
	  };

export type SubProcessRunnerEventTypes = {
	reset: SubProcessEvent;
	scrapeEvent: Action<AnyScrapeEvent>;
	changePhase: SubProcessChangeEvent;
	error: ScrapeErrorEvent;
};

export type ExURL = {
	/**
	 * Full URL (optimized)
	 */
	href: string;

	/**
	 * Full URL that before parse
	 */
	_originUrlString: string;

	/**
	 * Full URL without hash
	 */
	withoutHash: string;

	/**
	 * Full URL without hash and Authentication
	 */
	withoutHashAndAuth: string;

	/**
	 * Protocol or URI scheme (includes ":")
	 * - case-insensitive
	 */
	protocol: string;

	/**
	 * Whether protocol is HTTP or HTTPS
	 */
	isHTTP: boolean;

	/**
	 * Whether protocol is HTTPS
	 */
	isSecure: boolean;

	/**
	 * User name of authentication
	 */
	username: string | null;

	/**
	 * Password of authentication
	 */
	password: string | null;

	/**
	 * Host name
	 *
	 * - case-insensitive
	 * - encode non-ASCII characters
	 * - without port number
	 */
	hostname: string;

	/**
	 * Port number
	 */
	port: string | null;

	/**
	 * Path part
	 *
	 * It is only `/` if pathname is empty
	 *
	 * - case-sensitive
	 */
	pathname: string | null;

	/**
	 * Array of path
	 */
	paths: string[];

	/**
	 * Depth of paths
	 */
	depth: number;

	/**
	 * Directory name of paths
	 *
	 * It is null if it is `/` only
	 */
	dirname: string | null;

	/**
	 * Base name of paths (File name without file extension)
	 */
	basename: string | null;

	/**
	 * Whether index page (It's true if basename is null)
	 */
	isIndex: boolean;

	/**
	 * File extension name (inclues ".")
	 */
	extname: string | null;

	/**
	 * Search query (without `?`)
	 *
	 * - case-sensitive
	 */
	query: string | null;

	/**
	 * Hash (includes `#`)
	 *
	 * - case-sensitive
	 */
	hash: string | null;
};

export type ParseURLOptions = {
	disableQueries?: boolean;
};

export type PageData = {
	url: ExURL;
	redirectPaths: string[];
	isTarget: boolean;
	isExternal: boolean;
	status: number;
	statusText: string;
	contentType: string | null;
	contentLength: number | null;
	responseHeaders: Record<string, string | string[] | undefined> | null;
	meta: Meta;
	anchorList: AnchorData[];
	imageList: ImageElement[];
	html: string;
	isSkipped: false;
};

export type Meta = {
	lang?: string;
	title: string;
	description?: string;
	keywords?: string;
	noindex?: boolean;
	nofollow?: boolean;
	noarchive?: boolean;
	canonical?: string;
	alternate?: string;
	'og:type'?: string;
	'og:title'?: string;
	'og:site_name'?: string;
	'og:description'?: string;
	'og:url'?: string;
	'og:image'?: string;
	'twitter:card'?: string;
};

export type AnchorData = {
	/**
	 * Extracts the value of the `href` attribute from anchor element (`<a>` `<area>`)
	 */
	href: ExURL;

	/**
	 * The accessible name of the anchor element
	 */
	textContent: string;
};

export type ImageElement = {
	src: string;
	currentSrc: string;
	alt: string;
	width: number;
	height: number;
	naturalWidth: number;
	naturalHeight: number;
	isLazy: boolean;
	viewportWidth: number;
	sourceCode: string;
};

export type NetworkLog = {
	url: ExURL;
	status: number | null;
	contentLength: number;
	contentType: string;
	isError: boolean;
	request: {
		ts: number;
		headers: Record<string, string>;
		method: string;
	};
	response?: {
		ts: number;
		status: number;
		statusText: string;
		fromCache: boolean;
		headers: Record<string, string>;
	};
};

export type Resource = {
	url: ExURL;
	isExternal: boolean;
	isError: boolean;
	status: number | null;
	statusText: string | null;
	contentType: string | null;
	contentLength: number | null;
	compress: false | CompressType;
	cdn: false | CDNType;
	headers: Record<string, string | string[] | undefined> | null;
};

export type CompressType =
	| 'gzip'
	| 'compress'
	| 'deflate'
	| 'br'
	| 'sdch' // cspell:disable-line
	| 'vcdiff' // cspell:disable-line
	| 'xdelta'; // cspell:disable-line

export type CDNType = 'Amazon S3' | 'Amazon CloudFront' | 'IIJ' | 'Cloudflare' | 'Akamai';

export type HTTPMethod = 'HEAD' | 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';

export type SkippedPageData = {
	isSkipped: true;
	url: ExURL;
	matched:
		| {
				type: 'keyword';
				text: string;
				excludeKeywords: string[];
		  }
		| {
				type: 'path';
				excludes: string[];
		  };
};
