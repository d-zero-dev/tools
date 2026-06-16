/**
 * Provider-specific real-ID extraction rules.
 *
 * `simple-wappalyzer` identifies the *technology* (e.g., "Google Analytics") but
 * does not surface the actual account/measurement ID. We layer real-ID
 * extraction on top: for each detected provider, apply the registered regex
 * over the page HTML and surface what we find.
 *
 * Provider keys must match the names produced by `simple-wappalyzer` exactly;
 * these in turn track `wappalyzer-core@6` (the MIT-licensed fingerprint set).
 *
 * Keep the table **manually maintained**, not generated from Wappalyzer data.
 * @module
 */

export type IdExtractor = {
	/**
	 * Each regex MUST contain at most one capturing group; the captured text
	 * becomes the ID. Patterns without a capturing group fall back to
	 * `match[0]`.
	 */
	readonly patterns: readonly RegExp[];
};

/**
 * Lookup table keyed by Wappalyzer provider name.
 *
 * When extending: keep regexes anchored on stable, high-signal substrings
 * (the surrounding API call, not just the bare ID character class). Otherwise
 * the same regex will hit unrelated strings on pages that happen to share the
 * shape (e.g., AWS ARNs containing `GA-...`).
 */
export const ID_EXTRACTORS: Record<string, IdExtractor> = {
	'Google Analytics': {
		patterns: [
			/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]{4,20})['"]/g,
			/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]{4,20})/g,
			/\bga\(\s*['"]create['"]\s*,\s*['"](UA-\d{4,10}-\d{1,4})['"]/g,
			/['"](UA-\d{4,10}-\d{1,4})['"]/g,
		],
	},
	'Google Tag Manager': {
		patterns: [
			/googletagmanager\.com\/(?:gtm|ns)\.[a-z]+\?id=(GTM-[A-Z0-9]{4,12})/g,
			/['"](GTM-[A-Z0-9]{4,12})['"]/g,
		],
	},
	'Google Ads': {
		patterns: [/['"](AW-\d{4,12})['"]/g],
	},
	'Facebook Pixel': {
		patterns: [
			/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/g,
			/connect\.facebook\.net\/[^"']+\/fbevents\.js\D*(\d{6,20})/g,
		],
	},
	Hotjar: {
		patterns: [
			/hjid\s*[:=]\s*(\d{4,10})/g,
			/static\.hotjar\.com\/c\/hotjar-(\d{4,10})\.js/g,
		],
	},
	'Microsoft Clarity': {
		patterns: [
			/clarity\.ms\/tag\/([a-z0-9]{6,20})/g,
			/clarity\(\s*['"]start['"]\s*,\s*['"]([a-z0-9]{6,20})['"]/gi,
		],
	},
	Mixpanel: {
		patterns: [/mixpanel\.init\(\s*['"]([a-f0-9]{16,40})['"]/g],
	},
	Segment: {
		patterns: [
			/analytics\.load\(\s*['"]([a-zA-Z0-9]{8,40})['"]/g,
			/cdn\.segment\.com\/analytics\.js\/v1\/([a-zA-Z0-9]{8,40})/g,
		],
	},
	Amplitude: {
		patterns: [
			/amplitude\.init\(\s*['"]([a-f0-9]{16,40})['"]/g,
			/getInstance\(\)\.init\(\s*['"]([a-f0-9]{16,40})['"]/g,
		],
	},
	Heap: {
		patterns: [
			/heap\.load\(\s*['"](\d{6,20})['"]/g,
			/heap\.appid\s*=\s*['"](\d{6,20})['"]/g,
		],
	},
	PostHog: {
		patterns: [/posthog\.init\(\s*['"]([\w-]{16,80})['"]/g],
	},
	Plausible: {
		patterns: [/plausible\.io\/js\/script\.js[?&]domain=([a-zA-Z0-9.,-]+)/g],
	},
	Matomo: {
		patterns: [
			/_paq\.push\(\s*\[\s*['"]setSiteId['"]\s*,\s*['"]?(\d{1,6})['"]?\s*\]/g,
			/matomo\.php\?siteId=(\d{1,6})/g,
		],
	},
	'Adobe Analytics': {
		patterns: [
			/s_account\s*=\s*['"]([a-z0-9,]{3,50})['"]/gi,
			/s\.account\s*=\s*['"]([a-z0-9,]{3,50})['"]/gi,
		],
	},
	'Yandex Metrica': {
		patterns: [/ym\(\s*(\d{6,12})\s*,\s*['"]init['"]/g],
	},
	'LinkedIn Insight Tag': {
		patterns: [/_linkedin_partner_id\s*=\s*['"](\d{4,10})['"]/g],
	},
	'Twitter Ads': {
		patterns: [/twq\(\s*['"]config['"]\s*,\s*['"]([a-z0-9]{4,12})['"]/g],
	},
	'TikTok Pixel': {
		patterns: [
			/ttq\.load\(\s*['"]([A-Z0-9]{12,30})['"]/g,
			/tiktok\.com\/i18n\/pixel\/events\.js\?sdkid=([A-Z0-9]{12,30})/g,
		],
	},
	'Pinterest Tag': {
		patterns: [/pintrk\(\s*['"]load['"]\s*,\s*['"](\d{12,20})['"]/g],
	},
	'Bing Universal Event Tracking': {
		patterns: [
			/setAttribute\(\s*['"]data-tag['"]\s*,\s*['"](\d{6,20})['"]/g,
			/UET\(\{\s*ti:\s*['"](\d{6,20})['"]/g,
		],
	},
	Optimizely: {
		patterns: [/cdn\.optimizely\.com\/js\/(\d{6,20})\.js/g],
	},
	HubSpot: {
		patterns: [
			/js\.hs-?scripts\.com\/(\d{4,12})\.js/g,
			/js\.hubspot\.com\/web-interactives\/v1\/embeds\/(\d{4,12})/g,
		],
	},
	Sentry: {
		patterns: [
			/(https:\/\/[a-f0-9]+@[a-zA-Z0-9.-]+\.ingest\.sentry\.io\/\d+)/g,
			/(https:\/\/[a-f0-9]+@[a-zA-Z0-9.-]+\.sentry\.io\/\d+)/g,
		],
	},
	Intercom: {
		patterns: [
			/intercomSettings\s*=\s*\{[^}]*?app_id:\s*['"]([a-z0-9]{4,10})['"]/g,
			/Intercom\(\s*['"]boot['"]\s*,\s*\{[^}]*?app_id:\s*['"]([a-z0-9]{4,10})['"]/g,
		],
	},
	Drift: {
		patterns: [/drift\.load\(\s*['"]([a-z0-9]{6,30})['"]/g],
	},
	'Tawk.to': {
		patterns: [/embed\.tawk\.to\/([a-f0-9]{16,40})/g],
	},
	'Zendesk Chat': {
		patterns: [/static\.zdassets\.com\/ekr\/snippet\.js\?key=([a-f0-9-]{16,40})/g],
	},
	Cookiebot: {
		patterns: [/consent\.cookiebot\.com\/uc\.js[^"']*?cbid=([a-f0-9-]{16,40})/g],
	},
	OneTrust: {
		patterns: [/dataDomain['"=]\s*['"]?([a-z0-9-]{16,80})['"]?/gi],
	},
	Stripe: {
		patterns: [/js\.stripe\.com\/v\d+\//g],
	},
	'Google reCAPTCHA': {
		patterns: [/google\.com\/recaptcha\/api\.js[^"']*?(?:render=)?([\w-]{20,60})/g],
	},
	'Facebook for WordPress': {
		patterns: [/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/g],
	},
};

/**
 * Extracts real IDs for `provider` from the page HTML.
 *
 * Returns a de-duplicated, insertion-ordered list of IDs. Returns `[]` for
 * unknown providers (so callers can compose freely).
 * @param provider
 * @param html
 */
export function extractIds(provider: string, html: string): string[] {
	const extractor = ID_EXTRACTORS[provider];
	if (!extractor) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const pattern of extractor.patterns) {
		// Patterns must be `g`-flagged for `matchAll` to work without re-creating.
		const safe = pattern.flags.includes('g')
			? pattern
			: new RegExp(pattern.source, pattern.flags + 'g');
		for (const match of html.matchAll(safe)) {
			const id = match[1] ?? match[0];
			if (id && !seen.has(id)) {
				seen.add(id);
				result.push(id);
			}
		}
	}
	return result;
}
