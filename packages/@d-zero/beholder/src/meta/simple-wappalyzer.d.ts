/**
 * Ambient type declarations for `simple-wappalyzer` (no upstream types).
 *
 * Mirrors the runtime shape verified against the installed
 * `simple-wappalyzer@1.1.99` (`node_modules/simple-wappalyzer/src/index.js`):
 * the module exports a single async function taking `{ url, headers, html }`
 * and returning the resolved Wappalyzer technology list.
 *
 * Only the subset of fields actually consumed in {@link tag-detection.ts} is
 * declared; the runtime value may have more keys (icon, website, etc.) which
 * we ignore.
 */
declare module 'simple-wappalyzer' {
	export type WappalyzerCategory = {
		readonly id?: number;
		readonly slug?: string;
		readonly name?: string;
	};

	export type WappalyzerDetection = {
		readonly name: string;
		readonly version?: string;
		readonly confidence?: number;
		readonly icon?: string;
		readonly website?: string;
		readonly categories?: readonly WappalyzerCategory[];
	};

	export type WappalyzerInput = {
		readonly url: string;
		readonly html: string;
		readonly headers?: Record<string, string>;
	};

	const wappalyzer: (input: WappalyzerInput) => Promise<WappalyzerDetection[]>;
	export default wappalyzer;
}
