import { describe, expect, test } from 'vitest';

import { formatLines, generateDiff, truncateLine } from './diff-formatter.js';

describe('truncateLine', () => {
	test('should return line unchanged when width is greater than line length', () => {
		const result = truncateLine('short', 10);
		expect(result).toBe('short');
	});

	test('should truncate line when width is smaller than line length', () => {
		const result = truncateLine('this is a very long line', 20);
		expect(result).toBe('this is......ng line');
	});

	test('should handle edge case with minimum width', () => {
		const result = truncateLine('longtext', 8);
		expect(result).toBe('longtext');
	});
});

describe('formatLines', () => {
	test('should format single line with line number', () => {
		const result = formatLines(['hello'], 0, 80);
		expect(result).toBe('   0: hello');
	});

	test('should format multiple lines with sequential line numbers', () => {
		const result = formatLines(['first', 'second'], 1, 80);
		expect(result).toBe('   1: first\n   2: second');
	});

	test('should handle empty lines', () => {
		const result = formatLines(['', 'content'], 0, 80);
		expect(result).toBe('   0: \n   1: content');
	});

	test('should truncate long lines according to width', () => {
		const result = formatLines(['very long line that exceeds width'], 0, 20);
		expect(result).toBe('   0: v......s width');
	});
});

describe('generateDiff', () => {
	test('should generate diff for added content', () => {
		const blocks = [{ added: true, removed: false, value: 'new line\n' }];
		const result = generateDiff(blocks, '', 80);
		expect(result).toContain('   0: new line');
		expect(result).toContain('\u001B[32m');
	});

	test('should generate diff for removed content', () => {
		const blocks = [{ added: false, removed: true, value: 'deleted line\n' }];
		const result = generateDiff(blocks, 'deleted line\n', 80);
		expect(result).toContain('   0: deleted line');
		expect(result).toContain('\u001B[31m');
	});

	test('should generate diff for unchanged content with context', () => {
		const blocks = [{ added: false, removed: false, value: 'line1\nline2\nline3\n' }];
		const result = generateDiff(blocks, 'line1\nline2\nline3\n', 80);
		expect(result).toContain('   0: line1');
		expect(result).toContain('   1: line2');
		expect(result).toContain('   2: line3');
		expect(result).toContain('\u001B[30m');
	});

	test('should truncate large unchanged blocks with separator', () => {
		const longBlock = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n') + '\n';
		const blocks = [{ added: false, removed: false, value: longBlock }];
		const result = generateDiff(blocks, longBlock, 80);
		expect(result).toContain('line7');
		expect(result).toContain('line8');
		expect(result).toContain('line9');
	});

	test('should handle mixed diff blocks', () => {
		const blocks = [
			{ added: false, removed: false, value: 'unchanged\n' },
			{ added: true, removed: false, value: 'added\n' },
			{ added: false, removed: true, value: 'removed\n' },
		];
		const result = generateDiff(blocks, 'unchanged\nremoved\n', 80);
		expect(result).toContain('unchanged');
		expect(result).toContain('added');
		expect(result).toContain('removed');
	});
});
