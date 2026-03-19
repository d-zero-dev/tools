import { afterEach, test, expect, vi } from 'vitest';

import { fetchHtml } from './fetch-html.js';

afterEach(() => {
	vi.restoreAllMocks();
});

/**
 *
 * @param props
 */
function mockResponse(props: Partial<Response>): Response {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		headers: new Headers(),
		text: () => Promise.resolve(''),
		...props,
	} as Response;
}

test('returns HTML body on success', async () => {
	const html = '<html><body>Hello</body></html>';
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		mockResponse({ text: () => Promise.resolve(html) }),
	);

	const result = await fetchHtml('https://example.com');
	expect(result).toBe(html);
});

test('throws on non-ok response', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		mockResponse({ ok: false, status: 404, statusText: 'Not Found' }),
	);

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
	const fetchSpy = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(mockResponse({ text: () => Promise.resolve(html) }));

	const result = await fetchHtml('https://user:pass@example.com/page');
	expect(result).toBe(html);

	const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!;
	expect(calledUrl).toBe('https://example.com/page');
	expect((calledInit as RequestInit).headers).toEqual({
		Authorization: `Basic ${btoa('user:pass')}`,
	});
});

test('does not send Authorization header for URL without credentials', async () => {
	const fetchSpy = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(mockResponse({ text: () => Promise.resolve('') }));

	await fetchHtml('https://example.com');

	const [, calledInit] = fetchSpy.mock.calls[0]!;
	expect((calledInit as RequestInit).headers).toEqual({});
});

test('follows redirect and preserves Authorization header', async () => {
	const html = '<html><body>Redirected</body></html>';
	const fetchSpy = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(
			mockResponse({
				ok: false,
				status: 308,
				headers: new Headers({ location: 'http://example.com/page' }),
			}),
		)
		.mockResolvedValueOnce(mockResponse({ text: () => Promise.resolve(html) }));

	const result = await fetchHtml('https://user:pass@example.com/page');
	expect(result).toBe(html);

	expect(fetchSpy).toHaveBeenCalledTimes(2);
	const [, firstInit] = fetchSpy.mock.calls[0]!;
	expect((firstInit as RequestInit).redirect).toBe('manual');
	const [, secondInit] = fetchSpy.mock.calls[1]!;
	expect((secondInit as RequestInit).headers).toEqual({
		Authorization: `Basic ${btoa('user:pass')}`,
	});
});

test('throws on redirect without Location header', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		mockResponse({
			ok: false,
			status: 302,
			headers: new Headers(),
		}),
	);

	await expect(fetchHtml('https://example.com')).rejects.toThrow(
		'Redirect without Location header from https://example.com/',
	);
});

test('resolves relative redirect URL', async () => {
	const html = '<html>OK</html>';
	const fetchSpy = vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(
			mockResponse({
				ok: false,
				status: 301,
				headers: new Headers({ location: '/new-path' }),
			}),
		)
		.mockResolvedValueOnce(mockResponse({ text: () => Promise.resolve(html) }));

	const result = await fetchHtml('https://example.com/old-path');
	expect(result).toBe(html);

	const [secondUrl] = fetchSpy.mock.calls[1]!;
	expect(secondUrl).toBe('https://example.com/new-path');
});

test('throws on too many redirects', async () => {
	vi.spyOn(globalThis, 'fetch').mockResolvedValue(
		mockResponse({
			ok: false,
			status: 301,
			headers: new Headers({ location: 'https://example.com/loop' }),
		}),
	);

	await expect(fetchHtml('https://example.com')).rejects.toThrow(
		'Too many redirects fetching https://example.com',
	);
});
