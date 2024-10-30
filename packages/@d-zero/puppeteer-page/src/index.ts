export type { Page as Page, PageOptions } from './extended-page.js';

import type { PageOptions } from './extended-page.js';

import { Page } from './extended-page.js';

export function createPage(options: PageOptions) {
	return Page.create(options);
}
