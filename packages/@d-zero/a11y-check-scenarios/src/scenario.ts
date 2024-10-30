import type { ScenarioOptions } from './types.js';
import type { NeedAnalysis } from '@d-zero/a11y-check-core';
import type { Page } from '@d-zero/puppeteer-page';

import fs from 'node:fs/promises';
import path from 'node:path';

import { createScenario } from '@d-zero/a11y-check-core';
import { BinaryCache } from '@d-zero/shared/cache';
import { delay } from '@d-zero/shared/delay';
import { hash } from '@d-zero/shared/hash';

type Hit = HitUnder | HitOver;

type HitUnder = {
	type: 'under';
	x: number;
	y: number;
	rect: DOMRect;
};

type HitOver = {
	type: 'over';
	rect: DOMRect;
};

const scenarioId = 'a11y-check/scenario01';

export default createScenario((options?: ScenarioOptions) => {
	const cache = new BinaryCache(scenarioId, options?.cacheDir);

	const tests = [
		{
			name: 'SC 2.5.8 Target Size (Minimum)',
			description: 'Check if the target size is at least 44px by 44px',
			async test(page: Page) {
				await page.evaluate(() => {
					const hitEl = [
						...document.querySelectorAll('a,button,input,select,textarea,label,summary'),
					].filter((el) => !(el.matches('input,select,textarea') && el.closest('label')));
					const hits: Hit[] = [...hitEl]
						.map((el) => {
							const box = el.getBoundingClientRect();
							if (box.width < 0 && box.height < 0) {
								return null;
							}
							if (box.width < 24 || box.height < 24) {
								return {
									type: 'under',
									x: box.left + box.width / 2,
									y: box.top + box.height / 2,
									rect: box,
								};
							}
							return {
								type: 'over',
								rect: box,
							};
						})
						.filter((hit): hit is Hit => hit !== null);
					const cover = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
					const width = document.documentElement.scrollWidth;
					const height = document.documentElement.scrollHeight;
					cover.id = '__a11y-check-scenario01';
					cover.viewBox.baseVal.x = 0;
					cover.viewBox.baseVal.y = 0;
					cover.viewBox.baseVal.width = width;
					cover.viewBox.baseVal.height = height;
					cover.setAttribute('width', width + 'px');
					cover.setAttribute('height', height + 'px');
					cover.style.position = 'absolute';
					cover.style.top = '0';
					cover.style.left = '0';
					cover.style.zIndex = '100000';
					cover.style.pointerEvents = 'none';
					const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					for (const hit of hits) {
						if (hit.type === 'under') {
							const circle = document.createElementNS(
								'http://www.w3.org/2000/svg',
								'circle',
							);
							circle.cx.baseVal.value = hit.x;
							circle.cy.baseVal.value = hit.y;
							circle.r.baseVal.value = 12;
							circle.style.fill = 'rgba(255, 0, 0, 0.5)';
							g.append(circle);
						}
						const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
						rect.x.baseVal.value = hit.rect.left;
						rect.y.baseVal.value = hit.rect.top;
						rect.width.baseVal.value = hit.rect.width;
						rect.height.baseVal.value = hit.rect.height;
						rect.style.fill = 'rgba(255, 0, 0, 0.5)';
						g.append(rect);
					}
					cover.append(g);
					document.body.append(cover);
				});
			},
			async cleanUp(page: Page) {
				await page.evaluate(() => {
					const cover = document.getElementById('__a11y-check-scenario01');
					if (cover) {
						cover.remove();
					}
				});
			},
		},
		{
			name: 'SC 1.4.4 Text Resize',
			description:
				'Except for captions and images of text, text can be resized without assistive technology up to 200 percent without loss of content or functionality.',
			async test(page: Page) {
				await page.evaluate(() => {
					const style = document.createElement('style');
					style.id = '__a11y-check-scenario01';
					style.textContent = `:root { font-size: 200% !important; }`;
					document.head.append(style);
				});
			},
			async cleanUp(page: Page) {
				await page.evaluate(() => {
					const style = document.getElementById('__a11y-check-scenario01');
					if (style) {
						style.remove();
					}
				});
			},
		},
		{
			name: 'SC 1.4.12 Text Spacing',
			description:
				'Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing.',
			async test(page: Page) {
				await page.evaluate(() => {
					const style = document.createElement('style');
					style.id = '__a11y-check-scenario01';
					style.textContent = `* {
						/* Line height (line spacing) to at least 1.5 times the font size; */
						line-height: 1.5 !important;
						/* Spacing following paragraphs to at least 2 times the font size; */
						margin-block-end: 2em !important;
						/* Letter spacing (tracking) to at least 0.12 times the font size; */
						letter-spacing: 0.12em !important;
						/* Word spacing to at least 0.16 times the font size. */
						word-spacing: 0.16em !important;
					}`;
					document.head.append(style);
				});
			},
			async cleanUp(page: Page) {
				await page.evaluate(() => {
					const style = document.getElementById('__a11y-check-scenario01');
					if (style) {
						style.remove();
					}
				});
			},
		},
	];

	return {
		id: scenarioId,
		async exec(page, sizeName, logger) {
			// Wait Scroll End
			await delay(2000);

			if (options?.cache === false) {
				await cache.clear();
			}

			const needAnalysis: NeedAnalysis[] = [];

			for (const test of tests) {
				const key = page.url() + '#' + sizeName + '@' + test.name + '.png';

				logger(test.name + ': Check if the key exists in the cache');
				const exists = await cache.exists(key);

				if (exists) {
					logger(test.name + ': The key exists in the cache');
					return {};
				}

				logger(`${test.name}: ${test.description}`);
				await test.test(page);

				logger(`${test.name}: Screenshot`);
				let bin: Uint8Array;
				let retry = 0;
				// eslint-disable-next-line no-constant-condition
				while (true) {
					bin = await page.screenshot({
						type: 'png',
						fullPage: true,
						encoding: 'binary',
					});
					if (bin.length > 1) {
						break;
					}
					if (retry > 5) {
						throw new Error(
							[
								//
								'Failed to take a screenshot (scenario01)',
								`\tURL: ${page.url()}`,
								`\tSize: ${sizeName}`,
								`\tTest: ${test.name}`,
							].join('\n'),
						);
					}
					const retryTime = retry * 1000;
					logger(
						`${test.name}: Retry (${retry}times) to take a screenshot%dots% %countdown(${retryTime},${hash(key)}_${retryTime})%ms`,
					);
					await delay(retryTime);
					retry++;
				}
				const cachedFileName = await cache.store(key, bin);

				logger(`${test.name}: Clean up`);
				await test.cleanUp(page);

				needAnalysis.push({
					scenarioId,
					subKey: test.name,
					id: '',
					url: await page.url(),
					tool: `a11y-check-scenario01: ${test.name}`,
					timestamp: new Date(),
					component: null,
					environment: sizeName,
					data: cachedFileName,
				});
			}

			return {
				needAnalysis,
			};
		},
		async analyze(results, logger) {
			for (const test of tests) {
				const element: string[] = [];

				for (const data of results) {
					if (!data.data) {
						logger(`No screenshot: ${data.url}`);
						continue;
					}

					if (data.subKey !== test.name) {
						continue;
					}

					const img = await cache.loadDirectly(data.data);

					if (!img) {
						logger(`Failed to load the screenshot: ${data.url}`);
						continue;
					}

					const base64 = Buffer.from(img).toString('base64');

					element.push(
						`
					<p>${new URL(data.url).pathname} [${data.environment}]: ${data.subKey}</p>
					<img src="data:image/png;base64,${base64}" alt="${data.tool}" width="100%">
				`,
					);
				}

				const html = `<!DOCTYPE html>
					<html lang="ja">
					<head>
						<meta charset="UTF-8">
						<title>Accessibility Check Scenario 01: ${test.name}</title>
						<style>
							html {
								font-size: 100%;
							}
							body {
								background: black;
							}
							p {
								position: sticky;
								top: 0;
								background: #000;
								color: #fff;
								padding: 1em;
							}
							img {
								max-width: 100%;
								height: auto;
								width: 100rem;
								margin: 0 auto;
								display: block;
							}
						</style>
					</head>
					<body>
						${element.join('\n')}
					</body>
					</html>`;

				const fileName = `a11y-check-scenario01_${encodeURI(test.name)}.html`;

				logger(`Saving the result to ${fileName}`);
				await fs.writeFile(path.resolve(process.cwd(), fileName), html, 'utf8');
			}
		},
	};
});
