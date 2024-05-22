import type { PageData, ExURL } from './types.js';
import type { FollowResponse, RedirectableRequest } from 'follow-redirects';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';

import { delay } from '@d-zero/shared/delay';
import redirects from 'follow-redirects';

import NetTimeoutError from './net-timeout-error.js';

const cacheMap = new Map<string, PageData | Error>();

export async function fetchDestination(
	url: ExURL,
	isExternal: boolean,
	method = 'HEAD',
): Promise<PageData> {
	if (cacheMap.has(url.withoutHash)) {
		const cache = cacheMap.get(url.withoutHash)!;
		if (cache instanceof Error) {
			throw cache;
		}
		return cache;
	}

	const result = await Promise.race([
		_fetchHead(url, isExternal, method).catch((error) => new Error(error)),
		(async () => {
			await delay(10 * 1000);
			return new NetTimeoutError();
		})(),
	]);

	cacheMap.set(url.withoutHash, result);
	if (result instanceof Error) {
		throw result;
	}

	return result;
}

async function _fetchHead(url: ExURL, isExternal: boolean, method: string) {
	return new Promise<PageData>((resolve, reject) => {
		const request: RequestOptions = {
			protocol: url.protocol,
			host: url.hostname,
			path: url.pathname,
			method,
			headers: {
				host: url.hostname,
				Connection: 'keep-alive',
				Pragma: 'no-cache',
				'Cache-Control': 'no-cache',
				'Upgrade-Insecure-Requests': 1,
				// TODO: 'User-Agent': userAgent,
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9', // cspell:disable-line
				'Accept-Encoding': 'gzip, deflate',
				'Accept-Language':
					'ja,en;q=0.9,zh;q=0.8,en-US;q=0.7,pl;q=0.6,de;q=0.5,zh-CN;q=0.4,zh-TW;q=0.3,th;q=0.2,ko;q=0.1,fr;q=0.1',
			},
		};

		if (url.username && url.password) {
			request.auth = `${url.username}:${url.password}`;
		}

		let req: RedirectableRequest<ClientRequest, IncomingMessage>;
		const response = (res: IncomingMessage & FollowResponse) => {
			res.on('data', () => {});
			res.on('end', async () => {
				const redirectPaths = res.redirects.map((r) => r.url);
				const _contentLength = Number.parseInt(res.headers['content-length'] || '');
				const contentLength = Number.isFinite(_contentLength) ? _contentLength : null;
				let rep: PageData = {
					url,
					isTarget: !isExternal,
					isExternal,
					redirectPaths,
					status: res.statusCode || 0,
					statusText: res.statusMessage || '',
					contentType: res.headers['content-type']?.split(';')[0] || null,
					contentLength,
					responseHeaders: res.headers,
					meta: {
						title: '',
					},
					imageList: [],
					anchorList: [],
					html: '',
					isSkipped: false,
				};

				if (rep.status === 405) {
					if (method === 'GET') {
						reject(`Method Not Allowed: ${url} ${rep.statusText}`);
						return;
					}
					const rr = await fetchDestination(url, isExternal, 'GET').catch(
						(error) => error,
					);
					if (rr) {
						rep = rr;
					} else {
						reject(rr);
					}
				}

				if (rep.status === 501) {
					if (method === 'GET') {
						reject(`Method Not Implemented: ${url} ${rep.statusText}`);
						return;
					}
					await delay(5 * 1000);
					const rr = await fetchDestination(url, isExternal, 'GET').catch(
						(error) => error,
					);
					if (rr) {
						rep = rr;
					} else {
						reject(rr);
					}
				}

				if (rep.status === 503) {
					if (method === 'GET') {
						reject(`Retrying failed: ${url} ${rep.statusText}`);
						return;
					}
					await delay(5 * 1000);
					const rr = await fetchDestination(url, isExternal, 'GET').catch(
						(error) => error,
					);
					if (rr) {
						rep = rr;
					} else {
						reject(rr);
					}
				}

				resolve(rep);
			});
		};
		if (url.protocol === 'https:') {
			req = redirects.https.request(
				{
					...request,
					rejectUnauthorized: false,
				},
				response,
			);
		} else {
			req = redirects.http.request(request, response);
		}
		req.on('error', (error) => {
			reject(error);
		});
		req.write('head');
		req.end();
	});
}
