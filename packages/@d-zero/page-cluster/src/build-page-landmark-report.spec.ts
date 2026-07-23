import { describe, expect, test } from 'vitest';

import { buildPageLandmarkReport } from './build-page-landmark-report.js';
import { extractLandmarks } from './extract-landmarks.js';
import { tokenize } from './tokenize.js';

describe('buildPageLandmarkReport', () => {
	test('a header instance whose tokens are all shell tokens is reported as chrome', () => {
		const landmarks = extractLandmarks(
			'<body><header><nav><a>Home</a></nav></header><main>content</main></body>',
		);
		const shellTokens = new Set(
			tokenize(`<body>${landmarks.header[0]!.html}</body>`).tokens,
		);
		const report = buildPageLandmarkReport(landmarks, shellTokens);
		expect(report.header).toHaveLength(1);
		expect(report.header[0]!.isChrome).toBe(true);
	});

	test('an instance with no overlap with shell tokens is reported as content', () => {
		const landmarks = extractLandmarks(
			'<body><header><p class="unique-per-page">x</p></header><main>content</main></body>',
		);
		const shellTokens = new Set(['body>totally>unrelated']);
		const report = buildPageLandmarkReport(landmarks, shellTokens);
		expect(report.header[0]!.isChrome).toBe(false);
	});

	test('main instances carry no isChrome field', () => {
		const landmarks = extractLandmarks('<body><main>content</main></body>');
		const report = buildPageLandmarkReport(landmarks, new Set());
		expect(report.main).toHaveLength(1);
		expect(Object.keys(report.main[0]!)).not.toContain('isChrome');
	});

	test('a page with no landmarks yields all-empty arrays', () => {
		const landmarks = extractLandmarks('<body>content only</body>');
		const report = buildPageLandmarkReport(landmarks, new Set());
		expect(report).toStrictEqual({
			header: [],
			footer: [],
			nav: [],
			aside: [],
			form: [],
			search: [],
			main: [],
		});
	});

	test('each reported instance carries the instance position, not its html', () => {
		const landmarks = extractLandmarks('<body><header>H</header><main>M</main></body>');
		const report = buildPageLandmarkReport(landmarks, new Set());
		const source = landmarks.header[0]!;
		expect(report.header[0]).toStrictEqual({
			startOffset: source.startOffset,
			endOffset: source.endOffset,
			startLine: source.startLine,
			startColumn: source.startColumn,
			endLine: source.endLine,
			endColumn: source.endColumn,
			isChrome: false,
		});
	});
});
