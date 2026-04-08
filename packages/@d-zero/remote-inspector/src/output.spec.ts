import type { OutputHandler } from './output.js';
import type { FileComparison } from './types.js';

import { describe, expect, test, vi } from 'vitest';

import { ConsoleOutputHandler, displayComparison } from './output.js';

describe('ConsoleOutputHandler', () => {
	test('should return terminal width or default 80', () => {
		const handler = new ConsoleOutputHandler();
		const width = handler.getTerminalWidth();
		expect(typeof width).toBe('number');
		expect(width).toBeGreaterThan(0);
	});

	test('should log message to console', () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const handler = new ConsoleOutputHandler();

		handler.log('test message');

		expect(consoleSpy).toHaveBeenCalledWith('test message');
		consoleSpy.mockRestore();
	});
});

describe('displayComparison', () => {
	const createMockHandler = (): OutputHandler => ({
		log: vi.fn(),
		getTerminalWidth: vi.fn().mockReturnValue(80),
	});

	test('should display text file with green color', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/test.txt',
			remotePath: '/remote/test.txt',
			relativePath: 'test.txt',
			isTextFile: true,
			status: 'same',
			localSize: 100,
			remoteSize: 100,
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('test.txt'));
		expect(mockHandler.log).toHaveBeenCalledWith(
			expect.stringContaining('\u001B[1m\u001B[32m'),
		);
	});

	test('should display binary file with magenta color', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/image.png',
			remotePath: '/remote/image.png',
			relativePath: 'image.png',
			isTextFile: false,
			status: 'same',
			localSize: 1000,
			remoteSize: 1000,
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('image.png'));
		expect(mockHandler.log).toHaveBeenCalledWith(
			expect.stringContaining('\u001B[1m\u001B[35m'),
		);
	});

	test('should display missing file status', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/missing.txt',
			remotePath: '/remote/missing.txt',
			relativePath: 'missing.txt',
			isTextFile: true,
			status: 'missing',
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(
			expect.stringContaining('Local file is not found'),
		);
		expect(mockHandler.log).toHaveBeenCalledWith(
			expect.stringContaining('\u001B[31m\u001B[1m'),
		);
		expect(mockHandler.log).toHaveBeenCalledWith('');
	});

	test('should display new file status', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/new.txt',
			remotePath: '/remote/new.txt',
			relativePath: 'new.txt',
			isTextFile: true,
			status: 'new',
			localSize: 50,
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('New file'));
		expect(mockHandler.log).toHaveBeenCalledWith(
			expect.stringContaining('\u001B[32m\u001B[1m'),
		);
		expect(mockHandler.log).toHaveBeenCalledWith('');
	});

	test('should display same file status', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/same.txt',
			remotePath: '/remote/same.txt',
			relativePath: 'same.txt',
			isTextFile: true,
			status: 'same',
			localSize: 200,
			remoteSize: 200,
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('Same'));
		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('\u001B[42m'));
		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('200'));
		expect(mockHandler.log).toHaveBeenCalledWith('');
	});

	test('should display modified text file with diff', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/modified.txt',
			remotePath: '/remote/modified.txt',
			relativePath: 'modified.txt',
			isTextFile: true,
			status: 'modified',
			localSize: 100,
			remoteSize: 150,
			diff: 'mock diff content',
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('Modified'));
		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('\u001B[101m'));
		expect(mockHandler.log).toHaveBeenCalledWith('mock diff content');
		expect(mockHandler.log).toHaveBeenCalledWith('');
	});

	test('should display modified binary file without diff', () => {
		const mockHandler = createMockHandler();
		const comparison: FileComparison = {
			localPath: '/local/image.png',
			remotePath: '/remote/image.png',
			relativePath: 'image.png',
			isTextFile: false,
			status: 'modified',
			localSize: 1000,
			remoteSize: 1200,
		};

		displayComparison(comparison, mockHandler);

		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('Modified'));
		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('1000'));
		expect(mockHandler.log).toHaveBeenCalledWith(expect.stringContaining('1200'));
		expect(mockHandler.log).toHaveBeenCalledWith('');
	});
});
