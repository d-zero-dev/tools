import { describe, expect, it, vi } from 'vitest';

import { assembleTagsMeta, detectTags, EMPTY_TAGS_META } from './tag-detection.js';

vi.mock('simple-wappalyzer', () => ({
	default: vi.fn(),
}));

const importedModule = await import('simple-wappalyzer');
const wappalyzerMock = importedModule.default as unknown as ReturnType<typeof vi.fn>;

describe('assembleTagsMeta', () => {
	it('groups detections under their Wappalyzer categories', () => {
		const tags = assembleTagsMeta(
			[
				{
					name: 'Google Analytics',
					version: 'GA4',
					confidence: 100,
					categories: [{ name: 'Analytics' }],
				},
				{
					name: 'Google Tag Manager',
					confidence: 100,
					categories: [{ name: 'Tag Managers' }, { name: 'Analytics' }],
				},
			],
			'',
		);
		expect(tags.detected.Analytics).toBeDefined();
		expect(tags.detected.Analytics?.['Google Analytics']?.version).toBe('GA4');
		expect(tags.detected['Tag Managers']?.['Google Tag Manager']).toBeDefined();
		expect(tags.detected.Analytics?.['Google Tag Manager']).toBeDefined();
	});

	it('attaches extracted IDs to detail and emits one entry per ID', () => {
		const html = `<script>gtag('config', 'G-XYZ123')</script><script>gtag('config', 'G-AAA999')</script>`;
		const tags = assembleTagsMeta(
			[
				{
					name: 'Google Analytics',
					categories: [{ name: 'Analytics' }],
				},
			],
			html,
		);
		expect(tags.detected.Analytics?.['Google Analytics']?.ids).toEqual([
			'G-XYZ123',
			'G-AAA999',
		]);
		const providerEntries = tags.entries.filter((e) => e.provider === 'Google Analytics');
		expect(providerEntries.map((e) => e.id)).toEqual(['G-XYZ123', 'G-AAA999']);
	});

	it('emits one entry without id when no IDs are extracted', () => {
		const tags = assembleTagsMeta(
			[
				{
					name: 'jQuery',
					version: '3.6.0',
					categories: [{ name: 'JavaScript Libraries' }],
				},
			],
			'<html></html>',
		);
		expect(tags.entries).toHaveLength(1);
		expect(tags.entries[0]?.id).toBeUndefined();
		expect(tags.entries[0]?.version).toBe('3.6.0');
	});

	it('falls back to "Other" category when no categories are present', () => {
		const tags = assembleTagsMeta([{ name: 'Unknown', categories: [] }], '<html></html>');
		expect(tags.detected['Other']?.['Unknown']).toBeDefined();
	});

	it('skips detections without a name', () => {
		const tags = assembleTagsMeta(
			[{ name: '', categories: [{ name: 'Analytics' }] }],
			'<html></html>',
		);
		expect(tags.entries).toHaveLength(0);
		expect(Object.keys(tags.detected)).toHaveLength(0);
	});
});

describe('detectTags', () => {
	it('falls back to empty TagsMeta when simple-wappalyzer throws', async () => {
		wappalyzerMock.mockRejectedValueOnce(new Error('wappalyzer boom'));
		const result = await detectTags({
			url: 'https://example.com/',
			html: '<html></html>',
		});
		expect(result).toEqual(EMPTY_TAGS_META);
	});

	it('falls back to empty TagsMeta when simple-wappalyzer returns non-array', async () => {
		wappalyzerMock.mockResolvedValueOnce(null as unknown as never);
		const result = await detectTags({
			url: 'https://example.com/',
			html: '<html></html>',
		});
		expect(result).toEqual(EMPTY_TAGS_META);
	});

	it('passes detections through assembleTagsMeta', async () => {
		wappalyzerMock.mockResolvedValueOnce([
			{
				name: 'Google Analytics',
				version: 'GA4',
				categories: [{ name: 'Analytics' }],
			},
		] as never);
		const result = await detectTags({
			url: 'https://example.com/',
			html: `<script>gtag('config', 'G-XYZ123')</script>`,
		});
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]?.id).toBe('G-XYZ123');
	});

	it('normalizes headers to lowercase before calling wappalyzer', async () => {
		wappalyzerMock.mockResolvedValueOnce([] as never);
		await detectTags({
			url: 'https://example.com/',
			html: '<html></html>',
			headers: { 'Content-Type': 'text/html', 'X-Custom': ['a', 'b'] },
		});
		const arg = wappalyzerMock.mock.calls.at(-1)?.[0] as {
			headers?: Record<string, string>;
		};
		expect(arg?.headers?.['content-type']).toBe('text/html');
		expect(arg?.headers?.['x-custom']).toBe('a, b');
	});
});
