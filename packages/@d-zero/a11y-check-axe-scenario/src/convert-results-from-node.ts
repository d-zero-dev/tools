import type { Style } from '@d-zero/a11y-check-core';
import type { Page } from '@d-zero/puppeteer-page';
import type { NodeResult } from 'axe-core';

import path from 'node:path';

import { hash } from '@d-zero/shared/hash';

export async function convertResultsFromNode(
	page: Page,
	node: NodeResult,
	screenshot: boolean,
	log: (log: string) => void,
) {
	const target =
		node.target[0] && typeof node.target[0] === 'string' ? node.target[0] : null;

	if (!target) {
		return null;
	}

	log(`Node: ${target}`);

	let screenshotName: string | null = null;

	if (screenshot && target) {
		log(`Screenshot: ${target}`);
		const url = await page.url();
		const ssName = hash(url + target) + '.png';
		const elementScreenshot = await page.elementScreenshot(target, {
			path: path.resolve(process.cwd(), '.cache', ssName),
		});
		if (elementScreenshot) {
			screenshotName = ssName;
		}
	}

	const style: Style | null = await page.evaluate((selector) => {
		const el = document.querySelector(selector);
		if (!el) {
			return null;
		}

		const style = globalThis.getComputedStyle(el);
		const closest = {
			closestBackgroundColor: null as string | null,
			closestBackgroundImage: null as string | null,
		};

		let current = el.parentElement;
		while (current) {
			const currentStyle = globalThis.getComputedStyle(current);

			if (currentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
				closest.closestBackgroundColor = currentStyle.backgroundColor;
			}

			if (currentStyle.backgroundImage !== 'none') {
				closest.closestBackgroundImage = currentStyle.backgroundImage;
			}

			if (closest.closestBackgroundColor || closest.closestBackgroundImage) {
				break;
			}

			current = current.parentElement;
		}

		return {
			color: style.color,
			backgroundColor: style.backgroundColor,
			backgroundImage: style.backgroundImage,
			...closest,
		};
	}, target);

	log(`Get landmark: ${target}`);
	const landmark = await page.evaluate((selector) => {
		const el = document.querySelector(selector);
		if (!el) {
			return null;
		}

		if (el.closest('header, [role="banner"]')) {
			return 'header';
		}
		if (el.closest('footer, [role="contentinfo"]')) {
			return 'footer';
		}
		if (el.closest('nav, [role="navigation"]')) {
			return 'nav';
		}
		if (el.closest('main, [role="main"]')) {
			return 'main';
		}
		if (el.closest('aside, [role="complementary"]')) {
			return 'aside';
		}
		const identicalComponent = el.closest('[id]');
		if (identicalComponent) {
			return `#${identicalComponent.id}`;
		}
		return null;
	}, target);

	log(`Style: ${JSON.stringify(style)}`);
	return {
		screenshot: screenshotName,
		style,
		landmark,
	};
}
