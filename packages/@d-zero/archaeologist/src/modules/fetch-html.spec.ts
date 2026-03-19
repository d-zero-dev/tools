import { afterEach, test, expect, vi } from 'vitest';

import { fetchHtml } from './fetch-html.js';

afterEach(() => {
	vi.restoreAllMocks();
});

test('returns HTML body on success', async () => {
	const html = '<html><body>Hello</body></html>';
	vi.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		text: () => Promise.resolve(html),
	} as Response);

	const result = await fetchHtml('https://example.com');
	expect(result).toBe(html);
});

test('throws on non-ok response', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: false,
		status: 404,
		statusText: 'Not Found',
	} as Response);

	await expect(fetchHtml('https://example.com')).rejects.toThrow(
		'Failed to fetch https://example.com: 404 Not Found',
	);
});

test('throws on network error', async () => {
	vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

	await expect(fetchHtml('https://example.com')).rejects.toThrow('fetch failed');
});

test('sends Authorization header for Basic auth URL', async () => {
	const html = '<html><body>Auth</body></html>';
	const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		text: () => Promise.resolve(html),
	} as Response);

	const result = await fetchHtml('https://user:pass@example.com/page');
	expect(result).toBe(html);

	const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
	expect(calledUrl).toBe('https://example.com/page');
	expect((calledInit as RequestInit).headers).toEqual({
		Authorization: `Basic ${btoa('user:pass')}`,
	});
});

test('does not send Authorization header for URL without credentials', async () => {
	const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
		ok: true,
		text: () => Promise.resolve(''),
	} as Response);

	await fetchHtml('https://example.com');

	const [, calledInit] = fetchSpy.mock.calls[0]!;
	expect((calledInit as RequestInit).headers).toEqual({});
});
