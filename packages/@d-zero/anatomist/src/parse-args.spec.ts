import { describe, expect, it } from 'vitest';

import { parseArgs } from './parse-args.js';

describe('parseArgs', () => {
	it('returns defaults for an empty argv', () => {
		expect(parseArgs([])).toEqual({
			inputFormat: 'lines',
			viewports: [],
			innerHtml: 'all',
			noBoundingBox: false,
			pretty: false,
		});
	});

	it.each([
		['--help', 'help'],
		['-h', 'help'],
		['--version', 'version'],
		['-v', 'version'],
	] as const)('parses %s as %s', (flag, key) => {
		expect(parseArgs([flag])).toMatchObject({ [key]: true });
	});

	it('parses --input / -f with its value', () => {
		expect(parseArgs(['--input', 'urls.txt'])).toMatchObject({ input: 'urls.txt' });
		expect(parseArgs(['-f', 'urls.txt'])).toMatchObject({ input: 'urls.txt' });
	});

	it('parses --input-format', () => {
		expect(parseArgs(['--input-format', 'json'])).toMatchObject({ inputFormat: 'json' });
	});

	it('rejects an invalid --input-format value', () => {
		expect(parseArgs(['--input-format', 'yaml']).unknownFlag).toMatch(
			/"lines" or "json"/,
		);
	});

	it('parses --main-selector', () => {
		expect(parseArgs(['--main-selector', '#x'])).toMatchObject({ mainSelector: '#x' });
	});

	it('accumulates repeated --viewport flags', () => {
		expect(parseArgs(['--viewport', 'pc:1280', '--viewport', 'sp:375'])).toMatchObject({
			viewports: ['pc:1280', 'sp:375'],
		});
	});

	it('parses numeric options', () => {
		expect(parseArgs(['--max-depth', '4'])).toMatchObject({ maxDepth: 4 });
		expect(parseArgs(['--min-area', '500'])).toMatchObject({ minArea: 500 });
		expect(parseArgs(['--concurrency', '8'])).toMatchObject({ concurrency: 8 });
		expect(parseArgs(['--timeout', '30000'])).toMatchObject({ timeout: 30_000 });
		expect(parseArgs(['--max-scroll-height', '100000'])).toMatchObject({
			maxScrollHeight: 100_000,
		});
	});

	it('rejects a non-numeric value for a numeric option', () => {
		expect(parseArgs(['--max-depth', 'deep']).unknownFlag).toMatch(/requires a number/);
	});

	it('rejects a numeric option missing its value', () => {
		expect(parseArgs(['--max-depth']).unknownFlag).toMatch(/requires a number/);
	});

	it('parses --inner-html', () => {
		expect(parseArgs(['--inner-html', 'leaf-only'])).toMatchObject({
			innerHtml: 'leaf-only',
		});
		expect(parseArgs(['--inner-html', 'none'])).toMatchObject({ innerHtml: 'none' });
	});

	it('rejects an invalid --inner-html value', () => {
		expect(parseArgs(['--inner-html', 'bogus']).unknownFlag).toMatch(
			/"all", "leaf-only", or "none"/,
		);
	});

	it('parses --no-bounding-box as a boolean flag', () => {
		expect(parseArgs(['--no-bounding-box'])).toMatchObject({ noBoundingBox: true });
	});

	it('parses --out and --pretty', () => {
		expect(parseArgs(['--out', 'result.json', '--pretty'])).toMatchObject({
			out: 'result.json',
			pretty: true,
		});
	});

	it('reports an unrecognized flag and stops parsing', () => {
		const result = parseArgs(['--bogus', '--pretty']);
		expect(result.unknownFlag).toBe('--bogus');
		expect(result.pretty).toBe(false);
	});

	it('reports a missing value for a value-taking flag', () => {
		expect(parseArgs(['--input']).unknownFlag).toBe('--input requires a value');
	});
});
