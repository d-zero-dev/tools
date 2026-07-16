/**
 * @module @d-zero/beholder
 *
 * The beholder package provides page-level scraping capabilities for web crawlers.
 * It handles browser page navigation, DOM data extraction (anchors, images, meta tags),
 * network resource monitoring, and keyword-based page exclusion.
 *
 * Results are returned as values from `scrapeStart()`, not emitted as events.
 * Only streaming events (changePhase, resourceResponse) are emitted for progress monitoring.
 *
 * The main entry point is the `Scraper` class (default export).
 */
export { default as default } from './scraper.js';
export { isError } from './is-error.js';
export { extractMetaFromDocument } from './extract-meta.js';
export type { ExtractMetaContext } from './extract-meta.js';
export { detectCompress } from '@d-zero/shared/detect-compress';
export type { CompressType } from '@d-zero/shared/detect-compress';
export { detectCDN } from '@d-zero/shared/detect-cdn';
export type { CDNType } from '@d-zero/shared/detect-cdn';
export type { ScrapeResult, ResourceEntry, PageData } from './types.js';
export type { ScraperOptions, ChangePhaseEvent, ScraperEventTypes } from './types.js';
export type {
	Resource,
	AnchorData,
	Meta,
	ImageElement,
	SkippedPageData,
	NetworkLog,
	ScrollHeightData,
	MainContentsData,
	MainContentsMainTag,
	MainContentsHeading,
	MainContentsImage,
	MainContentsTable,
	MainContentsButton,
	MainContentsIframe,
	MainContentsVideo,
	MainContentsAudio,
	MainContentsCanvas,
	OpenGraphMeta,
	OgArticleMeta,
	OgBookMeta,
	OgProfileMeta,
	OgMusicMeta,
	OgVideoNsMeta,
	TwitterMeta,
	FbMeta,
	FediverseMeta,
	AppleMeta,
	MsApplicationMeta,
	VerificationMeta,
	GoogleMeta,
	GeoMeta,
	CitationMeta,
	RdfaMeta,
	MicrodataMeta,
	AmpMeta,
	LegacyMeta,
	MobileMeta,
	MicroformatsMeta,
	PinterestMeta,
	SlackMeta,
	LinkedInMeta,
	ExperimentalMeta,
	WikiMeta,
	LinkMeta,
	LinkEntry,
	JsonLdEntry,
	OthersBucket,
	ScriptEntry,
	IframeEntry,
	TagsMeta,
	TagDetail,
	TagEntry,
	TagSource,
	ViewportMeta,
	RobotsMeta,
	ReferrerMeta,
	FormatDetectionMeta,
	HttpEquivMeta,
	HttpEquivRefresh,
	RawHeadEntry,
} from './types.js';
