/**
 * Lookup tables mapping `<meta name>`, `<meta property>`, `<meta http-equiv>`,
 * `<meta itemprop>`, and `<link rel>` to their dot-path in `Meta`.
 *
 * Each key has a single canonical lowercase form. Cross-reference keys
 * (e.g., `format-detection` writes to both `formatDetection.*` and
 * `apple.formatDetectionTelephone`) use `paths` with more than one entry.
 *
 * Values referenced from `frontmatter-keys.md` in `../../frontend-env/`.
 * @module
 */

export type KeyTransform =
	| 'string'
	| 'number'
	| 'boolean-yes'
	| 'boolean-on'
	| 'boolean-true';

export type KeyDef = {
	/** One or more dot-paths under `Meta` to write the value into. */
	readonly paths: readonly string[];
	/** When `true`, repeated occurrences accumulate into an array at the path. */
	readonly multi?: boolean;
	/** Value normalization to apply. Defaults to `'string'`. */
	readonly transform?: KeyTransform;
};

/** Defines how a `<link rel>` is stored under `Meta.link`. */
export type LinkRelDef = {
	/** Dot-path under `Meta.link` (e.g., `'canonical'`, `'preload'`). */
	readonly path: string;
	/**
	 * `'single'` keeps the first; `'href-only'` stores the href string only;
	 * `'array'` accumulates `LinkEntry[]`; `'icon-sized'` accumulates only when
	 * `sizes` is set.
	 */
	readonly cardinality: 'single' | 'href-only' | 'array' | 'icon-sized';
};

/** `<meta name="X">` → dot-path in `Meta`. */
export const META_NAME_MAP: Record<string, KeyDef> = {
	'application-name': { paths: ['applicationName'] },
	author: { paths: ['author'] },
	description: { paths: ['description'] },
	generator: { paths: ['generator'] },
	keywords: { paths: ['keywords'] },
	creator: { paths: ['creator'] },
	publisher: { paths: ['publisher'] },
	'theme-color': { paths: ['themeColor'] },
	'color-scheme': { paths: ['colorScheme'] },
	'supported-color-schemes': { paths: ['supportedColorSchemes'] },
	googlebot: { paths: ['googlebot'] },
	'googlebot-news': { paths: ['googlebotNews'] },
	'googlebot-image': { paths: ['googlebotImage'] },
	'googlebot-video': { paths: ['googlebotVideo'] },
	bingbot: { paths: ['bingbot'] },
	slurp: { paths: ['slurp'] },
	duckduckbot: { paths: ['duckduckbot'] },
	yandex: { paths: ['yandex'] },
	baiduspider: { paths: ['baiduspider'] },
	ia_archiver: { paths: ['iaArchiver'] },
	'revisit-after': { paths: ['revisitAfter'] },
	rating: { paths: ['rating'] },
	distribution: { paths: ['distribution'] },
	classification: { paths: ['classification'] },
	category: { paths: ['category'] },
	subject: { paths: ['subject'] },
	topic: { paths: ['topic'] },
	summary: { paths: ['summary'] },
	abstract: { paths: ['abstract'] },
	audience: { paths: ['audience'] },
	target: { paths: ['target'] },
	copyright: { paths: ['copyright'] },
	designer: { paths: ['designer'] },
	owner: { paths: ['owner'] },
	'reply-to': { paths: ['replyTo'] },
	contact: { paths: ['contact'] },
	'identifier-url': { paths: ['identifierUrl'] },
	language: { paths: ['language'] },
	revision: { paths: ['revision'] },
	build: { paths: ['build'] },
	version: { paths: ['version'] },
	handheldfriendly: {
		paths: ['handheldFriendly', 'mobile.handheldFriendly', 'legacy.handheldFriendly'],
	},
	mobileoptimized: {
		paths: ['mobileOptimized', 'mobile.mobileOptimized', 'legacy.mobileOptimized'],
	},
	'mobile-web-app-capable': { paths: ['mobileWebAppCapable'] },
	'application-url': { paths: ['applicationUrl'] },
	theme: { paths: ['theme'] },

	// Apple iOS
	'apple-mobile-web-app-capable': {
		paths: ['apple.mobileWebAppCapable'],
		transform: 'boolean-yes',
	},
	'apple-mobile-web-app-status-bar-style': {
		paths: ['apple.mobileWebAppStatusBarStyle'],
	},
	'apple-mobile-web-app-title': { paths: ['apple.mobileWebAppTitle'] },
	'apple-touch-fullscreen': {
		paths: ['apple.touchFullscreen'],
		transform: 'boolean-yes',
	},
	'apple-itunes-app': { paths: ['apple.itunesApp'] },
	'apple-mobile-web-app-orientations': { paths: ['apple.mobileWebAppOrientations'] },
	'apple-touch-icon-title': { paths: ['apple.touchIconTitle'] },
	'apple-touch-startup-image': { paths: ['apple.touchStartupImage'] },

	// Microsoft
	'msapplication-tilecolor': { paths: ['msapplication.tileColor'] },
	'msapplication-tileimage': { paths: ['msapplication.tileImage'] },
	'msapplication-config': { paths: ['msapplication.config', 'msapplication.configFile'] },
	'msapplication-navbutton-color': { paths: ['msapplication.navbuttonColor'] },
	'msapplication-square70x70logo': { paths: ['msapplication.square70x70logo'] },
	'msapplication-square150x150logo': { paths: ['msapplication.square150x150logo'] },
	'msapplication-square310x310logo': { paths: ['msapplication.square310x310logo'] },
	'msapplication-wide310x150logo': { paths: ['msapplication.wide310x150logo'] },
	'msapplication-starturl': { paths: ['msapplication.starturl'] },
	'msapplication-window': { paths: ['msapplication.window'] },
	'msapplication-task': { paths: ['msapplication.task'], multi: true },
	'msapplication-task-separator': { paths: ['msapplication.taskSeparator'] },
	'msapplication-tooltip': { paths: ['msapplication.tooltip'] },
	'msapplication-notification': { paths: ['msapplication.notification'] },
	'msapplication-badge': { paths: ['msapplication.badge'] },
	'msapplication-tap-highlight': { paths: ['msapplication.tapHighlight'] },
	'msapplication-allowdomainapicalls': { paths: ['msapplication.allowDomainApiCalls'] },
	'msapplication-allowdomainmetatags': { paths: ['msapplication.allowDomainMetaTags'] },
	mssmarttagspreventparsing: {
		paths: ['msapplication.smartTagsPreventParsing', 'legacy.msSmartTagsPreventParsing'],
	},
	ie_rm_off: { paths: ['msapplication.ieRmOff'] },

	// Verification
	'google-site-verification': { paths: ['verification.google'] },
	'msvalidate.01': { paths: ['verification.bing'] },
	'yandex-verification': { paths: ['verification.yandex'] },
	'baidu-site-verification': { paths: ['verification.baidu'] },
	'naver-site-verification': { paths: ['verification.naver'] },
	'p:domain_verify': { paths: ['verification.pinterest'] },
	'facebook-domain-verification': { paths: ['verification.facebook'] },
	alexaverifyid: { paths: ['verification.alexa'] },
	'norton-safeweb-site-verification': { paths: ['verification.norton'] },
	'ahrefs-site-verification': { paths: ['verification.ahrefs'] },
	'detectify-verification': { paths: ['verification.detectify'] },
	'zoho-verification': { paths: ['verification.zoho'] },
	'wot-verification': { paths: ['verification.wot'] },
	'seznam-wmt': { paths: ['verification.seznam'] },
	'shopify-checkout-api-token': { paths: ['verification.shopify'] },
	'brave-rewards-verification': { paths: ['verification.brave'] },

	// Google-specific
	'google-translate-customization': { paths: ['google.translateCustomization'] },
	'google-adsense-account': { paths: ['google.adsenseAccount'] },
	'google-play-app': { paths: ['google.playApp'] },

	// Dublin Core
	'dc.title': { paths: ['dc.title'] },
	'dc.creator': { paths: ['dc.creator'] },
	'dc.subject': { paths: ['dc.subject'] },
	'dc.description': { paths: ['dc.description'] },
	'dc.publisher': { paths: ['dc.publisher'] },
	'dc.contributor': { paths: ['dc.contributor'] },
	'dc.date': { paths: ['dc.date'] },
	'dc.type': { paths: ['dc.type'] },
	'dc.format': { paths: ['dc.format'] },
	'dc.identifier': { paths: ['dc.identifier'] },
	'dc.source': { paths: ['dc.source'] },
	'dc.language': { paths: ['dc.language'] },
	'dc.relation': { paths: ['dc.relation'] },
	'dc.coverage': { paths: ['dc.coverage'] },
	'dc.rights': { paths: ['dc.rights'] },

	// DC Terms
	'dcterms.abstract': { paths: ['dcterms.abstract'] },
	'dcterms.accessrights': { paths: ['dcterms.accessRights'] },
	'dcterms.accrualmethod': { paths: ['dcterms.accrualMethod'] },
	'dcterms.accrualperiodicity': { paths: ['dcterms.accrualPeriodicity'] },
	'dcterms.accrualpolicy': { paths: ['dcterms.accrualPolicy'] },
	'dcterms.alternative': { paths: ['dcterms.alternative'] },
	'dcterms.audience': { paths: ['dcterms.audience'] },
	'dcterms.available': { paths: ['dcterms.available'] },
	'dcterms.bibliographiccitation': { paths: ['dcterms.bibliographicCitation'] },
	'dcterms.conformsto': { paths: ['dcterms.conformsTo'] },
	'dcterms.created': { paths: ['dcterms.created'] },
	'dcterms.dateaccepted': { paths: ['dcterms.dateAccepted'] },
	'dcterms.datecopyrighted': { paths: ['dcterms.dateCopyrighted'] },
	'dcterms.datesubmitted': { paths: ['dcterms.dateSubmitted'] },
	'dcterms.educationlevel': { paths: ['dcterms.educationLevel'] },
	'dcterms.extent': { paths: ['dcterms.extent'] },
	'dcterms.hasformat': { paths: ['dcterms.hasFormat'] },
	'dcterms.haspart': { paths: ['dcterms.hasPart'] },
	'dcterms.hasversion': { paths: ['dcterms.hasVersion'] },
	'dcterms.instructionalmethod': { paths: ['dcterms.instructionalMethod'] },
	'dcterms.isformatof': { paths: ['dcterms.isFormatOf'] },
	'dcterms.ispartof': { paths: ['dcterms.isPartOf'] },
	'dcterms.isreferencedby': { paths: ['dcterms.isReferencedBy'] },
	'dcterms.isreplacedby': { paths: ['dcterms.isReplacedBy'] },
	'dcterms.isrequiredby': { paths: ['dcterms.isRequiredBy'] },
	'dcterms.issued': { paths: ['dcterms.issued'] },
	'dcterms.isversionof': { paths: ['dcterms.isVersionOf'] },
	'dcterms.license': { paths: ['dcterms.license'] },
	'dcterms.mediator': { paths: ['dcterms.mediator'] },
	'dcterms.medium': { paths: ['dcterms.medium'] },
	'dcterms.modified': { paths: ['dcterms.modified'] },
	'dcterms.provenance': { paths: ['dcterms.provenance'] },
	'dcterms.references': { paths: ['dcterms.references'] },
	'dcterms.replaces': { paths: ['dcterms.replaces'] },
	'dcterms.requires': { paths: ['dcterms.requires'] },
	'dcterms.rightsholder': { paths: ['dcterms.rightsHolder'] },
	'dcterms.spatial': { paths: ['dcterms.spatial'] },
	'dcterms.tableofcontents': { paths: ['dcterms.tableOfContents'] },
	'dcterms.temporal': { paths: ['dcterms.temporal'] },
	'dcterms.valid': { paths: ['dcterms.valid'] },

	// Geo
	'geo.region': { paths: ['geo.region'] },
	'geo.placename': { paths: ['geo.placename'] },
	'geo.position': { paths: ['geo.position'] },
	'geo.country': { paths: ['geo.country'] },
	'geo.a1': { paths: ['geo.a1'] },
	'geo.a2': { paths: ['geo.a2'] },
	'geo.a3': { paths: ['geo.a3'] },
	'geo.lmk': { paths: ['geo.lmk'] },
	icbm: { paths: ['icbm'] },

	// Citation
	citation_title: { paths: ['citation.title'] },
	citation_author: { paths: ['citation.author'], multi: true },
	citation_author_email: { paths: ['citation.authorEmail'], multi: true },
	citation_author_institution: { paths: ['citation.authorInstitution'], multi: true },
	citation_publication_date: { paths: ['citation.publicationDate'] },
	citation_date: { paths: ['citation.date'] },
	citation_journal_title: { paths: ['citation.journalTitle'] },
	citation_journal_abbrev: { paths: ['citation.journalAbbrev'] },
	citation_conference_title: { paths: ['citation.conferenceTitle'] },
	citation_publisher: { paths: ['citation.publisher'] },
	citation_volume: { paths: ['citation.volume'] },
	citation_issue: { paths: ['citation.issue'] },
	citation_firstpage: { paths: ['citation.firstpage'] },
	citation_lastpage: { paths: ['citation.lastpage'] },
	citation_doi: { paths: ['citation.doi'] },
	citation_isbn: { paths: ['citation.isbn'] },
	citation_issn: { paths: ['citation.issn'] },
	citation_language: { paths: ['citation.language'] },
	citation_keywords: { paths: ['citation.keywords'] },
	citation_pdf_url: { paths: ['citation.pdfUrl'] },
	citation_fulltext_html_url: { paths: ['citation.fulltextHtmlUrl'] },
	citation_dissertation_institution: { paths: ['citation.dissertationInstitution'] },
	citation_technical_report_institution: {
		paths: ['citation.technicalReportInstitution'],
	},
	citation_technical_report_number: { paths: ['citation.technicalReportNumber'] },

	// CSRF
	'csrf-param': { paths: ['csrfParam'] },
	'csrf-token': { paths: ['csrfToken'] },

	// Misc
	'go-import': { paths: ['goImport'] },
	bitcoin: { paths: ['bitcoin'] },
	'origin-trial': { paths: ['originTrial'], multi: true },
	monetization: { paths: ['monetization'] },
	'payment-pointer': { paths: ['paymentPointer'] },
	'amp-experiments-opt-in': { paths: ['ampExperimentsOptIn', 'amp.experimentsOptIn'] },
	'amp-google-client-id-api': { paths: ['ampGoogleClientIdApi'] },

	// Pinterest
	'pinterest-rich-pin': { paths: ['pinterest.richPin'], transform: 'boolean-true' },
	pinterest: { paths: ['pinterest.nopin'], transform: 'boolean-true' },

	// Legacy
	imagetoolbar: { paths: ['legacy.imagetoolbar'] },
	'page-version': { paths: ['legacy.pageVersion'] },
	'resource-type': { paths: ['legacy.resourceType'] },
	'doc-class': { paths: ['legacy.docClass'] },
	'doc-rights': { paths: ['legacy.docRights'] },
	'doc-type': { paths: ['legacy.docType'] },

	// Mobile-specific
	'mobile-agent': { paths: ['mobile.mobileAgent'] },
	'full-screen': { paths: ['mobile.fullScreen'] },
	browsermode: { paths: ['mobile.browsermode'] },
	'x5-orientation': { paths: ['mobile.x5Orientation'] },
	'x5-fullscreen': { paths: ['mobile.x5Fullscreen'] },
	'x5-page-mode': { paths: ['mobile.x5PageMode'] },
	'screen-orientation': { paths: ['mobile.screenOrientation'] },
	layoutmode: { paths: ['mobile.layoutmode'] },
	imagemode: { paths: ['mobile.imagemode'] },

	// Twitter Cards (treated as name in HTML even though logically property-like)
	'twitter:card': { paths: ['twitter.card'] },
	'twitter:site': { paths: ['twitter.site'] },
	'twitter:site:id': { paths: ['twitter.siteId'] },
	'twitter:creator': { paths: ['twitter.creator'] },
	'twitter:creator:id': { paths: ['twitter.creatorId'] },
	'twitter:title': { paths: ['twitter.title'] },
	'twitter:description': { paths: ['twitter.description'] },
	'twitter:image': { paths: ['twitter.image'] },
	'twitter:image:src': { paths: ['twitter.imageSrc'] },
	'twitter:image:alt': { paths: ['twitter.imageAlt'] },
	'twitter:image:width': { paths: ['twitter.imageWidth'] },
	'twitter:image:height': { paths: ['twitter.imageHeight'] },
	'twitter:url': { paths: ['twitter.url'] },
	'twitter:domain': { paths: ['twitter.domain'] },
	'twitter:player': { paths: ['twitter.player'] },
	'twitter:player:width': { paths: ['twitter.playerWidth'] },
	'twitter:player:height': { paths: ['twitter.playerHeight'] },
	'twitter:player:stream': { paths: ['twitter.playerStream'] },
	'twitter:player:stream:content_type': { paths: ['twitter.playerStreamContentType'] },
	'twitter:app:name:iphone': { paths: ['twitter.appNameIphone'] },
	'twitter:app:id:iphone': { paths: ['twitter.appIdIphone'] },
	'twitter:app:url:iphone': { paths: ['twitter.appUrlIphone'] },
	'twitter:app:name:ipad': { paths: ['twitter.appNameIpad'] },
	'twitter:app:id:ipad': { paths: ['twitter.appIdIpad'] },
	'twitter:app:url:ipad': { paths: ['twitter.appUrlIpad'] },
	'twitter:app:name:googleplay': { paths: ['twitter.appNameGoogleplay'] },
	'twitter:app:id:googleplay': { paths: ['twitter.appIdGoogleplay'] },
	'twitter:app:url:googleplay': { paths: ['twitter.appUrlGoogleplay'] },
	'twitter:app:country': { paths: ['twitter.appCountry'] },
	'twitter:label1': { paths: ['twitter.label1'] },
	'twitter:data1': { paths: ['twitter.data1'] },
	'twitter:label2': { paths: ['twitter.label2'] },
	'twitter:data2': { paths: ['twitter.data2'] },
	'twitter:widgets:csp': { paths: ['twitter.widgetsCsp'] },
	'twitter:widgets:new-embed-design': { paths: ['twitter.widgetsNewEmbedDesign'] },
	'twitter:dnt': { paths: ['twitter.dnt'] },

	// Experimental / vendor
	'darkreader-lock': {
		paths: ['experimental.darkreaderLock'],
		transform: 'boolean-true',
	},
	'turbo-cache-control': { paths: ['experimental.turboCacheControl'] },
	'turbo-visit-control': { paths: ['experimental.turboVisitControl'] },
	'view-transition': { paths: ['experimental.viewTransition'] },

	// Wiki
	resourceloaderdynamicstyles: { paths: ['wiki.resourceLoaderDynamicStyles'] },
};

/** `<meta property="X">` → dot-path in `Meta`. */
export const META_PROPERTY_MAP: Record<string, KeyDef> = {
	'og:title': { paths: ['og.title'] },
	'og:type': { paths: ['og.type'] },
	'og:url': { paths: ['og.url'] },
	'og:site_name': { paths: ['og.siteName'] },
	'og:description': { paths: ['og.description'] },
	'og:determiner': { paths: ['og.determiner'] },
	'og:locale': { paths: ['og.locale'] },
	'og:locale:alternate': { paths: ['og.localeAlternate'], multi: true },

	'og:image': { paths: ['og.image'], multi: true },
	'og:image:url': { paths: ['og.imageUrl'] },
	'og:image:secure_url': { paths: ['og.imageSecureUrl'] },
	'og:image:type': { paths: ['og.imageType'] },
	'og:image:width': { paths: ['og.imageWidth'] },
	'og:image:height': { paths: ['og.imageHeight'] },
	'og:image:alt': { paths: ['og.imageAlt'] },

	'og:video': { paths: ['og.video'], multi: true },
	'og:video:url': { paths: ['og.videoUrl'] },
	'og:video:secure_url': { paths: ['og.videoSecureUrl'] },
	'og:video:type': { paths: ['og.videoType'] },
	'og:video:width': { paths: ['og.videoWidth'] },
	'og:video:height': { paths: ['og.videoHeight'] },
	'og:video:alt': { paths: ['og.videoAlt'] },

	'og:audio': { paths: ['og.audio'], multi: true },
	'og:audio:url': { paths: ['og.audioUrl'] },
	'og:audio:secure_url': { paths: ['og.audioSecureUrl'] },
	'og:audio:type': { paths: ['og.audioType'] },

	'article:published_time': { paths: ['og.article.publishedTime'] },
	'article:modified_time': { paths: ['og.article.modifiedTime'] },
	'article:expiration_time': { paths: ['og.article.expirationTime'] },
	'article:author': { paths: ['og.article.author'], multi: true },
	'article:section': { paths: ['og.article.section'] },
	'article:tag': { paths: ['og.article.tag'], multi: true },
	'article:publisher': { paths: ['og.article.publisher'] },

	'book:author': { paths: ['og.book.author'], multi: true },
	'book:isbn': { paths: ['og.book.isbn'] },
	'book:release_date': { paths: ['og.book.releaseDate'] },
	'book:tag': { paths: ['og.book.tag'], multi: true },

	'profile:first_name': { paths: ['og.profile.firstName'] },
	'profile:last_name': { paths: ['og.profile.lastName'] },
	'profile:username': { paths: ['og.profile.username'] },
	'profile:gender': { paths: ['og.profile.gender'] },

	'music:duration': { paths: ['og.music.duration'] },
	'music:album': { paths: ['og.music.album'], multi: true },
	'music:album:disc': { paths: ['og.music.albumDisc'] },
	'music:album:track': { paths: ['og.music.albumTrack'] },
	'music:musician': { paths: ['og.music.musician'], multi: true },
	'music:song': { paths: ['og.music.song'], multi: true },
	'music:song:disc': { paths: ['og.music.songDisc'] },
	'music:song:track': { paths: ['og.music.songTrack'] },
	'music:release_date': { paths: ['og.music.releaseDate'] },
	'music:creator': { paths: ['og.music.creator'], multi: true },

	'video:actor': { paths: ['og.videoNs.actor'], multi: true },
	'video:actor:role': { paths: ['og.videoNs.actorRole'] },
	'video:director': { paths: ['og.videoNs.director'], multi: true },
	'video:writer': { paths: ['og.videoNs.writer'], multi: true },
	'video:duration': { paths: ['og.videoNs.duration'] },
	'video:release_date': { paths: ['og.videoNs.releaseDate'] },
	'video:tag': { paths: ['og.videoNs.tag'], multi: true },
	'video:series': { paths: ['og.videoNs.series'] },

	'fb:app_id': { paths: ['fb.appId'] },
	'fb:admins': { paths: ['fb.admins'], multi: true },
	'fb:pages': { paths: ['fb.pages'], multi: true },

	'fediverse:creator': { paths: ['fediverse.creator'] },
};

/** `<meta http-equiv="X">` → dot-path in `Meta.httpEquiv`. */
export const HTTP_EQUIV_MAP: Record<string, KeyDef> = {
	'content-type': { paths: ['httpEquiv.contentType'] },
	'content-language': { paths: ['httpEquiv.contentLanguage'] },
	'default-style': { paths: ['httpEquiv.defaultStyle'] },
	refresh: { paths: ['httpEquiv.refresh'] },
	'x-ua-compatible': { paths: ['httpEquiv.xUaCompatible'] },
	'content-security-policy': { paths: ['httpEquiv.contentSecurityPolicy'] },
	'content-security-policy-report-only': {
		paths: ['httpEquiv.contentSecurityPolicyReportOnly'],
	},
	'set-cookie': { paths: ['httpEquiv.setCookie'] },
	pragma: { paths: ['httpEquiv.pragma'] },
	'cache-control': { paths: ['httpEquiv.cacheControl'] },
	expires: { paths: ['httpEquiv.expires'] },
	'accept-ch': { paths: ['httpEquiv.acceptCh'] },
	'delegate-ch': { paths: ['httpEquiv.delegateCh'] },
	'permissions-policy': {
		paths: ['httpEquiv.permissionsPolicy', 'httpEquiv.permissionsPolicyValue'],
	},
	'origin-trial': {
		paths: ['httpEquiv.originTrial', 'httpEquiv.originTrialToken'],
		multi: true,
	},
	'x-dns-prefetch-control': { paths: ['httpEquiv.xDnsPrefetchControl'] },
	'window-target': { paths: ['httpEquiv.windowTarget'] },
	imagetoolbar: { paths: ['httpEquiv.imagetoolbar'] },
	cleartype: { paths: ['httpEquiv.cleartype', 'msapplication.cleartype'] },
};

/** `<meta itemprop="X">` → dot-path in `Meta.itemprop`. */
export const ITEMPROP_MAP: Record<string, KeyDef> = {
	name: { paths: ['itemprop.name'] },
	description: { paths: ['itemprop.description'] },
	image: { paths: ['itemprop.image'] },
};

/** `<link rel="X">` → dot-path in `Meta.link`. */
export const LINK_REL_MAP: Record<string, LinkRelDef> = {
	canonical: { path: 'canonical', cardinality: 'href-only' },
	alternate: { path: 'alternateHreflang', cardinality: 'array' },
	amphtml: { path: 'amphtml', cardinality: 'href-only' },
	author: { path: 'author', cardinality: 'href-only' },
	bookmark: { path: 'bookmark', cardinality: 'href-only' },
	help: { path: 'help', cardinality: 'href-only' },
	license: { path: 'license', cardinality: 'href-only' },
	next: { path: 'next', cardinality: 'href-only' },
	prev: { path: 'prev', cardinality: 'href-only' },
	previous: { path: 'previous', cardinality: 'href-only' },
	first: { path: 'first', cardinality: 'href-only' },
	last: { path: 'last', cardinality: 'href-only' },
	up: { path: 'up', cardinality: 'href-only' },
	index: { path: 'index', cardinality: 'href-only' },
	contents: { path: 'contents', cardinality: 'href-only' },
	start: { path: 'start', cardinality: 'href-only' },
	search: { path: 'search', cardinality: 'single' },
	tag: { path: 'tag', cardinality: 'array' },
	archives: { path: 'archives', cardinality: 'array' },
	publisher: { path: 'publisher', cardinality: 'href-only' },
	'privacy-policy': { path: 'privacyPolicy', cardinality: 'href-only' },
	'terms-of-service': { path: 'termsOfService', cardinality: 'href-only' },
	copyright: { path: 'copyright', cardinality: 'href-only' },
	appendix: { path: 'appendix', cardinality: 'array' },
	chapter: { path: 'chapter', cardinality: 'array' },
	section: { path: 'section', cardinality: 'array' },
	subsection: { path: 'subsection', cardinality: 'array' },
	glossary: { path: 'glossary', cardinality: 'href-only' },
	profile: { path: 'profile', cardinality: 'array' },
	edituri: { path: 'editUri', cardinality: 'href-only' },
	pingback: { path: 'pingback', cardinality: 'href-only' },
	webmention: { path: 'webmention', cardinality: 'href-only' },
	micropub: { path: 'micropub', cardinality: 'href-only' },
	microsub: { path: 'microsub', cardinality: 'href-only' },
	me: { path: 'me', cardinality: 'array' },
	authorization_endpoint: { path: 'authorizationEndpoint', cardinality: 'href-only' },
	token_endpoint: { path: 'tokenEndpoint', cardinality: 'href-only' },
	'indieauth-metadata': { path: 'indieauthMetadata', cardinality: 'href-only' },
	'openid.server': { path: 'openidServer', cardinality: 'href-only' },
	'openid.delegate': { path: 'openidDelegate', cardinality: 'href-only' },
	'openid2.provider': { path: 'openid2Provider', cardinality: 'href-only' },
	'openid2.local_id': { path: 'openid2LocalId', cardinality: 'href-only' },
	hub: { path: 'hub', cardinality: 'href-only' },
	self: { path: 'self', cardinality: 'href-only' },
	payment: { path: 'payment', cardinality: 'href-only' },
	enclosure: { path: 'enclosure', cardinality: 'array' },
	external: { path: 'external', cardinality: 'array' },
	nofollow: { path: 'nofollow', cardinality: 'array' },
	sponsored: { path: 'sponsored', cardinality: 'array' },
	ugc: { path: 'ugc', cardinality: 'array' },
	noopener: { path: 'noopener', cardinality: 'array' },
	noreferrer: { path: 'noreferrer', cardinality: 'array' },
	opener: { path: 'opener', cardinality: 'array' },
	image_src: { path: 'imageSrc', cardinality: 'href-only' },
	shortlink: { path: 'shortlink', cardinality: 'href-only' },
	'dns-prefetch': { path: 'dnsPrefetch', cardinality: 'array' },
	preconnect: { path: 'preconnect', cardinality: 'array' },
	prefetch: { path: 'prefetch', cardinality: 'array' },
	prerender: { path: 'prerender', cardinality: 'array' },
	preload: { path: 'preload', cardinality: 'array' },
	modulepreload: { path: 'modulepreload', cardinality: 'array' },
	expect: { path: 'expect', cardinality: 'array' },
	stylesheet: { path: 'stylesheet', cardinality: 'array' },
	manifest: { path: 'manifest', cardinality: 'href-only' },
	serviceworker: { path: 'serviceworker', cardinality: 'href-only' },
	dpp: { path: 'dpp', cardinality: 'href-only' },
	gbfs: { path: 'gbfs', cardinality: 'href-only' },
	syndication: { path: 'syndication', cardinality: 'array' },
	'api-catalog': { path: 'apiCatalog', cardinality: 'href-only' },
	memento: { path: 'memento', cardinality: 'href-only' },
	timegate: { path: 'timegate', cardinality: 'href-only' },
	timemap: { path: 'timemap', cardinality: 'href-only' },
	'version-history': { path: 'versionHistory', cardinality: 'href-only' },
	'latest-version': { path: 'latestVersion', cardinality: 'href-only' },
	'predecessor-version': { path: 'predecessorVersion', cardinality: 'href-only' },
	'successor-version': { path: 'successorVersion', cardinality: 'href-only' },
	'working-copy': { path: 'workingCopy', cardinality: 'href-only' },
	'working-copy-of': { path: 'workingCopyOf', cardinality: 'href-only' },
	describedby: { path: 'describedby', cardinality: 'href-only' },
	describes: { path: 'describes', cardinality: 'href-only' },
	via: { path: 'via', cardinality: 'href-only' },
	related: { path: 'related', cardinality: 'array' },
	'cite-as': { path: 'citeAs', cardinality: 'href-only' },
	disclosure: { path: 'disclosure', cardinality: 'href-only' },
	status: { path: 'status', cardinality: 'href-only' },
	sunset: { path: 'sunset', cardinality: 'href-only' },
	deprecation: { path: 'deprecation', cardinality: 'href-only' },
	lrdd: { path: 'lrdd', cardinality: 'href-only' },
	hosts: { path: 'hosts', cardinality: 'href-only' },
	service: { path: 'service', cardinality: 'href-only' },
	'service-desc': { path: 'serviceDesc', cardinality: 'href-only' },
	'service-doc': { path: 'serviceDoc', cardinality: 'href-only' },
	'service-meta': { path: 'serviceMeta', cardinality: 'href-only' },
	'c2pa-manifest': { path: 'c2paManifest', cardinality: 'href-only' },
	'compression-dictionary': { path: 'compressionDictionary', cardinality: 'href-only' },

	icon: { path: 'icon', cardinality: 'single' },
	'shortcut icon': { path: 'shortcutIcon', cardinality: 'href-only' },
	'apple-touch-icon': { path: 'appleTouchIcon', cardinality: 'single' },
	'apple-touch-icon-precomposed': {
		path: 'appleTouchIconPrecomposed',
		cardinality: 'array',
	},
	'apple-touch-startup-image': { path: 'appleTouchStartupImage', cardinality: 'array' },
	'mask-icon': { path: 'maskIcon', cardinality: 'single' },
	'fluid-icon': { path: 'fluidIcon', cardinality: 'single' },

	'security.txt': { path: 'securityTxt', cardinality: 'href-only' },
};
