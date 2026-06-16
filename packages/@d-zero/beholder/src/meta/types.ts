/**
 * Type definitions for the `Meta` data extracted from a page's `<head>` and full document.
 *
 * Structure follows the reference table in `frontmatter-keys.md`, with one dot-path
 * field per category. Optional fields are absent when not detected on the page.
 * Array fields are required and default to `[]` so consumers can iterate without
 * null-checks.
 * @see {@link ./classify.ts} for the function that builds `Meta` from raw head entries
 * @see {@link ./parsers.ts} for the value normalizers used by `classify`
 * @module
 */

/**
 * Top-level metadata extracted from a page's `<head>` and surrounding markup
 * (`<html>`, `<base>`, `<noscript>`, `<iframe>` in body, `<script>` of known
 * structured-data types).
 *
 * Required fields (`title`, `jsonLd`, `speculationRules`, `others`, `tags`)
 * always exist so downstream consumers can iterate without null-checking the
 * top level.
 */
export type Meta = {
	/** The text content of the `<title>` element. */
	title: string;

	/** The `lang` attribute of the `<html>` element. */
	lang?: string;
	/** The `dir` attribute of the `<html>` element. */
	dir?: string;
	/** The `xmlns` attribute of the `<html>` element (rare; RDFa contexts). */
	xmlns?: string;
	/** The `prefix` attribute of the `<html>` element (RDFa). */
	prefix?: string;
	/** The `vocab` attribute of the `<html>` element (RDFa). */
	vocab?: string;
	/** The `typeof` attribute of the `<html>` element (RDFa). */
	typeOf?: string;
	/** The `itemtype` attribute of the `<html>` element (Microdata). */
	itemType?: string;
	/** The `<meta charset>` value, or `null` if absent. */
	charset?: string;
	/** The `<base href>` value, or `null` if absent. */
	baseHref?: string;
	/** The `<base target>` value, or `null` if absent. */
	baseTarget?: string;

	/** `<meta name="description">` content. */
	description?: string;
	/** `<meta name="keywords">` content. */
	keywords?: string;
	/** `<meta name="application-name">` content. */
	applicationName?: string;
	/** `<meta name="author">` content. */
	author?: string;
	/** `<meta name="generator">` content. */
	generator?: string;
	/** `<meta name="creator">` content. */
	creator?: string;
	/** `<meta name="publisher">` content. */
	publisher?: string;
	/** `<meta name="theme-color">` (no `media` attribute) content. */
	themeColor?: string;
	/** `<meta name="theme-color" media="(prefers-color-scheme: light)">` content. */
	themeColorLight?: string;
	/** `<meta name="theme-color" media="(prefers-color-scheme: dark)">` content. */
	themeColorDark?: string;
	/** `<meta name="color-scheme">` content. */
	colorScheme?: string;
	/** `<meta name="supported-color-schemes">` content. */
	supportedColorSchemes?: string;

	/** Parsed `<meta name="viewport">`. */
	viewport?: ViewportMeta;
	/** Parsed `<meta name="robots">`. */
	robots?: RobotsMeta;
	/** Parsed `<meta name="referrer">` and its sub-policies. */
	referrer?: ReferrerMeta;
	/** Parsed `<meta name="format-detection">` and Apple cross-references. */
	formatDetection?: FormatDetectionMeta;

	/** `<meta name="googlebot">` and other crawler-specific directives. */
	googlebot?: string;
	googlebotNews?: string;
	googlebotImage?: string;
	googlebotVideo?: string;
	bingbot?: string;
	slurp?: string;
	duckduckbot?: string;
	yandex?: string;
	baiduspider?: string;
	iaArchiver?: string;
	revisitAfter?: string;
	rating?: string;
	distribution?: string;
	classification?: string;
	category?: string;
	subject?: string;
	topic?: string;
	summary?: string;
	abstract?: string;
	audience?: string;
	target?: string;
	copyright?: string;
	designer?: string;
	owner?: string;
	replyTo?: string;
	contact?: string;
	identifierUrl?: string;
	language?: string;
	revision?: string;
	build?: string;
	version?: string;
	handheldFriendly?: string;
	mobileOptimized?: string;
	mobileWebAppCapable?: string;
	applicationUrl?: string;
	theme?: string;

	/** Parsed `http-equiv` attributes. */
	httpEquiv?: HttpEquivMeta;

	/** Open Graph tags (`og:*`, `article:*`, `book:*`, `profile:*`, `music:*`, `video:*`). */
	og?: OpenGraphMeta;
	/** Twitter Card tags (`twitter:*`). */
	twitter?: TwitterMeta;
	/** Facebook tags (`fb:*`). */
	fb?: FbMeta;
	/** Fediverse tags (`fediverse:*`). */
	fediverse?: FediverseMeta;
	/** Apple iOS tags. */
	apple?: AppleMeta;
	/** Microsoft application tile tags (`msapplication-*`). */
	msapplication?: MsApplicationMeta;
	/** Site verification tags. */
	verification?: VerificationMeta;
	/** Google-specific tags (`google`, `google-*`). */
	google?: GoogleMeta;
	/** Dublin Core (`DC.*`) tags. */
	dc?: Record<string, string>;
	/** DC Terms (`DCTERMS.*`) tags. */
	dcterms?: Record<string, string>;
	/** Geo tags. */
	geo?: GeoMeta;
	/** `<meta name="ICBM" content="{lat}, {lng}">` content. */
	icbm?: string;
	/** Academic citation (`citation_*`) tags. */
	citation?: CitationMeta;

	/** CSRF param name (`<meta name="csrf-param">`). */
	csrfParam?: string;
	/** CSRF token (`<meta name="csrf-token">`). */
	csrfToken?: string;

	/** Misc single-value tags. */
	goImport?: string;
	bitcoin?: string;
	originTrial: string[];
	monetization?: string;
	paymentPointer?: string;
	ampExperimentsOptIn?: string;
	ampGoogleClientIdApi?: string;

	/** `<meta itemprop="...">` tags (Microdata in head). */
	itemprop?: {
		name?: string;
		description?: string;
		image?: string;
	} & Record<string, string | string[]>;

	/** Parsed `<link>` elements. */
	link?: LinkMeta;

	/** All `<script type="application/ld+json">` entries. */
	jsonLd: JsonLdEntry[];
	/** All `<script type="speculationrules">` entries. */
	speculationRules: JsonLdEntry[];

	/** RDFa attributes on `<html>` (mirror of top-level fields, kept for explicit access). */
	rdfa?: RdfaMeta;
	/** Microdata attributes on `<html>`. */
	microdata?: MicrodataMeta;

	/** AMP-related markers. */
	amp?: AmpMeta;

	/** Legacy meta tags (kept for completeness). */
	legacy?: LegacyMeta;

	/** Mobile-specific meta tags. */
	mobile?: MobileMeta;

	/** Microformats2 markers in head. */
	microformats?: MicroformatsMeta;

	/** Pinterest-specific tags. */
	pinterest?: PinterestMeta;

	/** Slack/LinkedIn-specific notes (cross-references to og:* tags). */
	slack?: SlackMeta;
	linkedin?: LinkedInMeta;

	/** Experimental / vendor-specific tags. */
	experimental?: ExperimentalMeta;

	/** Wikipedia / MediaWiki-specific tags. */
	wiki?: WikiMeta;

	/** Detected third-party tags (analytics, frameworks, libraries, etc.). */
	tags: TagsMeta;

	/** Unknown / future / vendor-specific markup not covered by typed fields. */
	others: OthersBucket;

	/** Raw head entries for debugging. Only present when `getMeta` is called with `includeRaw: true`. */
	_raw?: readonly RawHeadEntry[];
};

/**
 * Parsed `<meta name="viewport">` content.
 * The `raw` string is always preserved so consumers can re-parse unknown directives.
 */
export type ViewportMeta = {
	raw: string;
	width?: string;
	height?: string;
	initialScale?: number;
	minimumScale?: number;
	maximumScale?: number;
	userScalable?: boolean | string;
	viewportFit?: string;
	interactiveWidget?: string;
};

/**
 * Parsed `<meta name="robots">` and crawler directives.
 */
export type RobotsMeta = {
	raw: string;
	index?: boolean;
	noindex?: boolean;
	follow?: boolean;
	nofollow?: boolean;
	none?: boolean;
	all?: boolean;
	noarchive?: boolean;
	nosnippet?: boolean;
	noimageindex?: boolean;
	nocache?: boolean;
	notranslate?: boolean;
	noodp?: boolean;
	noydir?: boolean;
	indexifembedded?: boolean;
	maxSnippet?: number;
	maxImagePreview?: string;
	maxVideoPreview?: number;
	unavailableAfter?: string;
};

/**
 * Parsed `<meta name="referrer">` and its individual policy values.
 */
export type ReferrerMeta = {
	raw: string;
	noReferrer?: boolean;
	origin?: boolean;
	originWhenCrossOrigin?: boolean;
	strictOrigin?: boolean;
	strictOriginWhenCrossOrigin?: boolean;
	unsafeUrl?: boolean;
	sameOrigin?: boolean;
	noReferrerWhenDowngrade?: boolean;
};

/**
 * Parsed `<meta name="format-detection">` content.
 */
export type FormatDetectionMeta = {
	raw: string;
	telephone?: boolean;
	email?: boolean;
	address?: boolean;
	date?: boolean;
};

/**
 * Parsed `http-equiv` attribute values.
 */
export type HttpEquivMeta = {
	contentType?: string;
	contentLanguage?: string;
	defaultStyle?: string;
	refresh?: HttpEquivRefresh;
	xUaCompatible?: string;
	contentSecurityPolicy?: string;
	contentSecurityPolicyReportOnly?: string;
	setCookie?: string;
	pragma?: string;
	cacheControl?: string;
	expires?: string;
	acceptCh?: string;
	delegateCh?: string;
	permissionsPolicy?: string;
	originTrial?: string;
	originTrialToken: string[];
	xDnsPrefetchControl?: string;
	windowTarget?: string;
	imagetoolbar?: string;
	cleartype?: string;
	permissionsPolicyValue?: string;
};

/** Parsed `<meta http-equiv="refresh">` content. */
export type HttpEquivRefresh = {
	raw: string;
	seconds?: number;
	url?: string;
};

/**
 * Open Graph tags including all sub-namespaces (article, book, profile, music, video).
 */
export type OpenGraphMeta = {
	title?: string;
	type?: string;
	url?: string;
	siteName?: string;
	description?: string;
	determiner?: string;
	locale?: string;
	localeAlternate: string[];

	image: string[];
	imageUrl?: string;
	imageSecureUrl?: string;
	imageType?: string;
	imageWidth?: string;
	imageHeight?: string;
	imageAlt?: string;

	video: string[];
	videoUrl?: string;
	videoSecureUrl?: string;
	videoType?: string;
	videoWidth?: string;
	videoHeight?: string;
	videoAlt?: string;

	audio: string[];
	audioUrl?: string;
	audioSecureUrl?: string;
	audioType?: string;

	article?: OgArticleMeta;
	book?: OgBookMeta;
	profile?: OgProfileMeta;
	music?: OgMusicMeta;
	videoNs?: OgVideoNsMeta;
};

export type OgArticleMeta = {
	publishedTime?: string;
	modifiedTime?: string;
	expirationTime?: string;
	author: string[];
	section?: string;
	tag: string[];
	publisher?: string;
};

export type OgBookMeta = {
	author: string[];
	isbn?: string;
	releaseDate?: string;
	tag: string[];
};

export type OgProfileMeta = {
	firstName?: string;
	lastName?: string;
	username?: string;
	gender?: string;
};

export type OgMusicMeta = {
	duration?: string;
	album: string[];
	albumDisc?: string;
	albumTrack?: string;
	musician: string[];
	song: string[];
	songDisc?: string;
	songTrack?: string;
	releaseDate?: string;
	creator: string[];
};

export type OgVideoNsMeta = {
	actor: string[];
	actorRole?: string;
	director: string[];
	writer: string[];
	duration?: string;
	releaseDate?: string;
	tag: string[];
	series?: string;
};

/**
 * Twitter Card tags.
 */
export type TwitterMeta = {
	card?: string;
	site?: string;
	siteId?: string;
	creator?: string;
	creatorId?: string;
	title?: string;
	description?: string;
	image?: string;
	imageSrc?: string;
	imageAlt?: string;
	imageWidth?: string;
	imageHeight?: string;
	url?: string;
	domain?: string;
	player?: string;
	playerWidth?: string;
	playerHeight?: string;
	playerStream?: string;
	playerStreamContentType?: string;
	appNameIphone?: string;
	appIdIphone?: string;
	appUrlIphone?: string;
	appNameIpad?: string;
	appIdIpad?: string;
	appUrlIpad?: string;
	appNameGoogleplay?: string;
	appIdGoogleplay?: string;
	appUrlGoogleplay?: string;
	appCountry?: string;
	label1?: string;
	data1?: string;
	label2?: string;
	data2?: string;
	widgetsCsp?: string;
	widgetsNewEmbedDesign?: string;
	dnt?: string;
};

/** Facebook tags (`fb:*` and `facebook-domain-verification`). */
export type FbMeta = {
	appId?: string;
	admins: string[];
	pages: string[];
};

/** Fediverse tags. */
export type FediverseMeta = {
	creator?: string;
};

/** Apple iOS-specific tags. */
export type AppleMeta = {
	mobileWebAppCapable?: boolean | string;
	mobileWebAppStatusBarStyle?: string;
	mobileWebAppTitle?: string;
	touchFullscreen?: boolean | string;
	itunesApp?: string;
	mobileWebAppOrientations?: string;
	touchIconTitle?: string;
	touchStartupImage?: string;
	formatDetectionTelephone?: boolean;
};

/** Microsoft application tile tags. */
export type MsApplicationMeta = {
	tileColor?: string;
	tileImage?: string;
	config?: string;
	configFile?: string;
	navbuttonColor?: string;
	square70x70logo?: string;
	square150x150logo?: string;
	square310x310logo?: string;
	wide310x150logo?: string;
	starturl?: string;
	window?: string;
	task: string[];
	taskSeparator?: string;
	tooltip?: string;
	notification?: string;
	badge?: string;
	tapHighlight?: string;
	allowDomainApiCalls?: string;
	allowDomainMetaTags?: string;
	cleartype?: string;
	smartTagsPreventParsing?: string;
	ieRmOff?: string;
};

/** Site verification tags. */
export type VerificationMeta = {
	google?: string;
	bing?: string;
	yandex?: string;
	baidu?: string;
	naver?: string;
	pinterest?: string;
	facebook?: string;
	alexa?: string;
	norton?: string;
	ahrefs?: string;
	detectify?: string;
	zoho?: string;
	wot?: string;
	seznam?: string;
	shopify?: string;
	brave?: string;
};

/** Google-specific tags. */
export type GoogleMeta = {
	notranslate?: boolean;
	nositelinkssearchbox?: boolean;
	nopagereadaloud?: boolean;
	translateCustomization?: string;
	adsenseAccount?: string;
	playApp?: string;
	googlebotNotranslate?: boolean;
};

/** Geo tags. */
export type GeoMeta = {
	region?: string;
	placename?: string;
	position?: string;
	country?: string;
	a1?: string;
	a2?: string;
	a3?: string;
	lmk?: string;
};

/** Academic citation tags. */
export type CitationMeta = {
	title?: string;
	author: string[];
	authorEmail: string[];
	authorInstitution: string[];
	publicationDate?: string;
	date?: string;
	journalTitle?: string;
	journalAbbrev?: string;
	conferenceTitle?: string;
	publisher?: string;
	volume?: string;
	issue?: string;
	firstpage?: string;
	lastpage?: string;
	doi?: string;
	isbn?: string;
	issn?: string;
	language?: string;
	keywords?: string;
	pdfUrl?: string;
	fulltextHtmlUrl?: string;
	dissertationInstitution?: string;
	technicalReportInstitution?: string;
	technicalReportNumber?: string;
};

/** RDFa attributes mirrored from `<html>` element. */
export type RdfaMeta = {
	prefix?: string;
	vocab?: string;
	typeOf?: string;
};

/** Microdata attributes mirrored from `<html>` element. */
export type MicrodataMeta = {
	itemscope?: boolean;
	itemtype?: string;
};

/** AMP markers. */
export type AmpMeta = {
	enabled?: boolean;
	lightning?: boolean;
	canonicalFromAmp?: string;
	amphtml?: string;
	experimentsOptIn?: string;
	runtimeScript?: boolean;
};

/** Legacy meta tags. */
export type LegacyMeta = {
	msSmartTagsPreventParsing?: string;
	imagetoolbar?: string;
	pageVersion?: string;
	audience?: string;
	resourceType?: string;
	distribution?: string;
	docClass?: string;
	docRights?: string;
	docType?: string;
	mobileOptimized?: string;
	handheldFriendly?: string;
};

/** Mobile-specific meta tags. */
export type MobileMeta = {
	handheldFriendly?: string;
	mobileOptimized?: string;
	mobileAgent?: string;
	fullScreen?: string;
	browsermode?: string;
	x5Orientation?: string;
	x5Fullscreen?: string;
	x5PageMode?: string;
	screenOrientation?: string;
	layoutmode?: string;
	imagemode?: string;
};

/** Microformats2 markers in head. */
export type MicroformatsMeta = {
	relMe: string[];
};

/** Pinterest tags. */
export type PinterestMeta = {
	richPin?: boolean;
	nopin?: boolean;
	disableRichPin?: boolean;
};

/** Slack-specific notes (cross-reference for og:image:width=1200). */
export type SlackMeta = {
	ogImageWidth?: string;
};

/** LinkedIn-specific notes. */
export type LinkedInMeta = {
	ogType?: string;
};

/** Experimental / vendor tags. */
export type ExperimentalMeta = {
	darkreaderLock?: boolean;
	turboCacheControl?: string;
	turboVisitControl?: string;
	viewTransition?: string;
};

/** Wikipedia / MediaWiki tags. */
export type WikiMeta = {
	resourceLoaderDynamicStyles?: string;
	mediawikiGenerator?: string;
};

/**
 * Parsed `<link>` elements grouped by `rel`. Single-rel entries are stored on
 * named fields; multi-rel and unknown rels are stored on `others.link[]`.
 */
export type LinkMeta = {
	canonical?: string;
	alternateHreflang: LinkEntry[];
	alternateMedia: LinkEntry[];
	alternateRss: LinkEntry[];
	alternateAtom: LinkEntry[];
	alternateJsonFeed: LinkEntry[];
	oembedJson?: LinkEntry;
	oembedXml?: LinkEntry;
	alternateActivityJson?: LinkEntry;
	amphtml?: string;
	author?: string;
	bookmark?: string;
	help?: string;
	license?: string;
	next?: string;
	prev?: string;
	previous?: string;
	first?: string;
	last?: string;
	up?: string;
	index?: string;
	contents?: string;
	start?: string;
	search?: LinkEntry;
	tag: LinkEntry[];
	archives: LinkEntry[];
	publisher?: string;
	privacyPolicy?: string;
	termsOfService?: string;
	copyright?: string;
	appendix: LinkEntry[];
	chapter: LinkEntry[];
	section: LinkEntry[];
	subsection: LinkEntry[];
	glossary?: string;
	profile: LinkEntry[];
	editUri?: string;
	pingback?: string;
	webmention?: string;
	micropub?: string;
	microsub?: string;
	me: LinkEntry[];
	authorizationEndpoint?: string;
	tokenEndpoint?: string;
	indieauthMetadata?: string;
	openidServer?: string;
	openidDelegate?: string;
	openid2Provider?: string;
	openid2LocalId?: string;
	hub?: string;
	self?: string;
	payment?: string;
	enclosure: LinkEntry[];
	external: LinkEntry[];
	nofollow: LinkEntry[];
	sponsored: LinkEntry[];
	ugc: LinkEntry[];
	noopener: LinkEntry[];
	noreferrer: LinkEntry[];
	opener: LinkEntry[];
	imageSrc?: string;
	shortlink?: string;
	dnsPrefetch: LinkEntry[];
	preconnect: LinkEntry[];
	prefetch: LinkEntry[];
	prerender: LinkEntry[];
	preload: LinkEntry[];
	modulepreload: LinkEntry[];
	expect: LinkEntry[];
	stylesheet: LinkEntry[];
	manifest?: string;
	serviceworker?: string;
	dpp?: string;
	gbfs?: string;
	syndication: LinkEntry[];
	apiCatalog?: string;
	memento?: string;
	timegate?: string;
	timemap?: string;
	versionHistory?: string;
	latestVersion?: string;
	predecessorVersion?: string;
	successorVersion?: string;
	workingCopy?: string;
	workingCopyOf?: string;
	describedby?: string;
	describes?: string;
	via?: string;
	related: LinkEntry[];
	citeAs?: string;
	disclosure?: string;
	status?: string;
	sunset?: string;
	deprecation?: string;
	lrdd?: string;
	hosts?: string;
	service?: string;
	serviceDesc?: string;
	serviceDoc?: string;
	serviceMeta?: string;
	c2paManifest?: string;
	compressionDictionary?: string;

	icon?: LinkEntry;
	iconAny?: LinkEntry;
	iconSvg?: LinkEntry;
	iconSized: LinkEntry[];
	shortcutIcon?: string;
	appleTouchIcon?: LinkEntry;
	appleTouchIconSized: LinkEntry[];
	appleTouchIconPrecomposed: LinkEntry[];
	appleTouchStartupImage: LinkEntry[];
	appleTouchStartupImageIphone?: LinkEntry;
	appleTouchStartupImageIpadPortrait?: LinkEntry;
	appleTouchStartupImageIpadLandscape?: LinkEntry;
	maskIcon?: LinkEntry;
	fluidIcon?: LinkEntry;

	securityTxt?: string;
};

/**
 * Common shape of a parsed `<link>` element.
 */
export type LinkEntry = {
	href: string;
	rel: readonly string[];
	type?: string;
	media?: string;
	sizes?: string;
	title?: string;
	hreflang?: string;
	as?: string;
	crossorigin?: string;
	color?: string;
	blocking?: string;
	imagesrcset?: string;
};

/**
 * A `<script type="application/ld+json">` or `<script type="speculationrules">`
 * entry. `parsed` holds the result of `JSON.parse(raw)`; on parse failure
 * `parseError` is set and `parsed` is `undefined`.
 */
export type JsonLdEntry = {
	raw: string;
	parsed?: unknown;
	parseError?: string;
};

/**
 * Catch-all bucket for markup not covered by typed fields above. Always present
 * (empty values when no unknowns were found) so consumers can iterate without
 * null-checking.
 */
export type OthersBucket = {
	/** Unknown `<meta name>` → list of `content` values. */
	meta: Record<string, string[]>;
	/** Unknown `<meta property>` → list of `content` values. */
	property: Record<string, string[]>;
	/** Unknown `<meta http-equiv>` → list of `content` values. */
	httpEquiv: Record<string, string[]>;
	/** Unknown `<meta itemprop>` → list of `content` values. */
	itemprop: Record<string, string[]>;
	/** `<link>` elements whose every `rel` is unknown. */
	link: LinkEntry[];
	/** `<script>` elements with unknown `type` (kept for raw inspection). */
	script: ScriptEntry[];
	/** `<iframe>` elements (used to capture GTM noscript iframes, etc.). */
	iframe: IframeEntry[];
};

export type ScriptEntry = {
	type: string;
	content?: string;
	src?: string;
	location: 'head' | 'body' | 'noscript';
};

export type IframeEntry = {
	src: string;
	location: 'head' | 'body' | 'noscript';
};

/**
 * Detected third-party tags from the page (analytics, frameworks, libraries,
 * etc.). Produced by `tag-detection.ts` by combining `simple-wappalyzer`
 * results with ID extractors.
 */
export type TagsMeta = {
	/** Wappalyzer category name → provider name → detection detail. */
	detected: Record<string, Record<string, TagDetail>>;
	/** Flat list of all detected entries (one per (provider, id) tuple). */
	entries: TagEntry[];
};

export type TagDetail = {
	/** Real IDs extracted from the page (e.g., `G-XXXX`, `GTM-XXXX`). */
	ids: string[];
	/** Wappalyzer-reported version, if available. */
	version?: string;
	/** Wappalyzer-reported confidence (0-100), if available. */
	confidence?: number;
};

export type TagEntry = {
	provider: string;
	categories: readonly string[];
	id?: string;
	version?: string;
	confidence?: number;
	sources: readonly TagSource[];
};

export type TagSource = {
	type:
		| 'script-src'
		| 'inline'
		| 'iframe-src'
		| 'window-global'
		| 'img-src'
		| 'header'
		| 'meta'
		| 'html';
	src?: string;
	location?: 'head' | 'body' | 'noscript';
	globalName?: string;
};

/**
 * Discriminated union of raw entries collected from the page by `collectHead`.
 * Used as the input shape for `classify()`. Keeping this serializable lets us
 * collect on the browser side and process on the Node side.
 */
export type RawHeadEntry =
	| {
			kind: 'html';
			lang?: string;
			dir?: string;
			xmlns?: string;
			prefix?: string;
			vocab?: string;
			typeOf?: string;
			itemscope?: boolean;
			itemtype?: string;
			amp?: boolean;
			lightning?: boolean;
	  }
	| { kind: 'title'; content: string }
	| { kind: 'base'; href?: string; target?: string }
	| {
			kind: 'meta';
			name?: string;
			property?: string;
			httpEquiv?: string;
			itemprop?: string;
			charset?: string;
			content?: string;
			media?: string;
	  }
	| {
			kind: 'link';
			rel: readonly string[];
			href: string;
			type?: string;
			media?: string;
			sizes?: string;
			title?: string;
			hreflang?: string;
			as?: string;
			crossorigin?: string;
			color?: string;
			blocking?: string;
			imagesrcset?: string;
	  }
	| {
			kind: 'script';
			scriptType: string;
			content?: string;
			src?: string;
			location: 'head' | 'body' | 'noscript';
	  }
	| { kind: 'iframe'; src: string; location: 'head' | 'body' | 'noscript' }
	| { kind: 'window-global'; names: readonly string[] };
