import { describe, expect, it } from 'vitest';

import { extractIds } from './id-extractors.js';

describe('extractIds', () => {
	it('returns [] for unknown provider', () => {
		expect(extractIds('NonExistentProvider', '<html></html>')).toEqual([]);
	});

	it('extracts GA4 measurement ID from gtag config', () => {
		const html = `<script>gtag('config', 'G-ABCD1234XY')</script>`;
		expect(extractIds('Google Analytics', html)).toContain('G-ABCD1234XY');
	});

	it('extracts GA4 measurement ID from script src', () => {
		const html = `<script src="https://www.googletagmanager.com/gtag/js?id=G-XYZW9876AB"></script>`;
		expect(extractIds('Google Analytics', html)).toContain('G-XYZW9876AB');
	});

	it('extracts UA tracking ID', () => {
		const html = `<script>ga('create', 'UA-12345678-1', 'auto');</script>`;
		expect(extractIds('Google Analytics', html)).toContain('UA-12345678-1');
	});

	it('extracts GTM container ID from src and inline', () => {
		const html = `
			<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123"></script>
			<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-ABCD123"></iframe></noscript>
		`;
		const ids = extractIds('Google Tag Manager', html);
		expect(ids).toContain('GTM-ABCD123');
		expect(ids.length).toBe(1);
	});

	it('extracts Facebook Pixel ID from fbq init', () => {
		const html = `<script>fbq('init', '123456789012345');</script>`;
		expect(extractIds('Facebook Pixel', html)).toContain('123456789012345');
	});

	it('extracts Hotjar site ID from inline', () => {
		const html = `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){};h._hjSettings={hjid:1234567,hjsv:6};})(window,document)</script>`;
		expect(extractIds('Hotjar', html)).toContain('1234567');
	});

	it('extracts Microsoft Clarity project ID from src', () => {
		const html = `<script src="https://www.clarity.ms/tag/abc123xyz"></script>`;
		expect(extractIds('Microsoft Clarity', html)).toContain('abc123xyz');
	});

	it('extracts TikTok pixel ID from ttq.load', () => {
		const html = `<script>ttq.load('ABCDEFGH12345678')</script>`;
		expect(extractIds('TikTok Pixel', html)).toContain('ABCDEFGH12345678');
	});

	it('deduplicates IDs across multiple patterns', () => {
		const html = `
			<script src="https://www.googletagmanager.com/gtag/js?id=G-DUP12345A"></script>
			<script>gtag('config', 'G-DUP12345A');</script>
		`;
		const ids = extractIds('Google Analytics', html);
		const dupCount = ids.filter((id) => id === 'G-DUP12345A').length;
		expect(dupCount).toBe(1);
	});

	it('extracts Yandex Metrica counter ID from ym init', () => {
		const html = `<script>ym(12345678, 'init', { clickmap:true });</script>`;
		expect(extractIds('Yandex Metrica', html)).toContain('12345678');
	});
});
