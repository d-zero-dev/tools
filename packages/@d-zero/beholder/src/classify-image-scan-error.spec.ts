import { NavigationUnsettledError } from '@d-zero/puppeteer-page-scan';
import { describe, expect, it } from 'vitest';

import { classifyImageScanError } from './classify-image-scan-error.js';
import { IMAGE_SCAN_CODE } from './image-scan-code.js';

describe('classifyImageScanError', () => {
	it('NavigationUnsettledError は NAV_UNSETTLED に分類する', () => {
		expect(classifyImageScanError(new NavigationUnsettledError('never settled'))).toBe(
			IMAGE_SCAN_CODE.NAV_UNSETTLED,
		);
	});

	it.each([
		"Attempted to use detached Frame 'XXX'.",
		'Session closed.',
		'Execution context was destroyed.',
		'Protocol error (Page.reload): Not attached to an active page',
		'Protocol error (Page.reload): Target closed',
	])('%s は FRAME_LOST に分類する', (message) => {
		expect(classifyImageScanError(new Error(message))).toBe(IMAGE_SCAN_CODE.FRAME_LOST);
	});

	it('分類不能な Error は UNKNOWN に分類する', () => {
		expect(classifyImageScanError(new Error('TypeError: foo is not a function'))).toBe(
			IMAGE_SCAN_CODE.UNKNOWN,
		);
	});

	it('Error インスタンスでない値も UNKNOWN に分類する', () => {
		expect(classifyImageScanError('plain string error')).toBe(IMAGE_SCAN_CODE.UNKNOWN);
		expect(classifyImageScanError(null)).toBe(IMAGE_SCAN_CODE.UNKNOWN);
	});
});
