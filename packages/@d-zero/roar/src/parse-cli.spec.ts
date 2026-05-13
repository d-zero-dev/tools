import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { parseCli } from './parse-cli.js';

const testSettings = {
	name: 'test-cli',
	commands: {
		crawl: {
			desc: 'Crawl a website',
			flags: {
				depth: {
					type: 'number' as const,
					shortFlag: 'd',
					desc: 'Max depth',
					default: 10,
				},
				verbose: { type: 'boolean' as const, shortFlag: 'v', desc: 'Verbose output' },
				url: { type: 'string' as const, shortFlag: 'u', desc: 'Target URL' },
			},
		},
		analyze: {
			desc: 'Run analysis',
		},
	},
	onError: vi.fn().mockReturnValue(true),
} as const;

/**
 * Replace process.argv for testing.
 * @param args - Arguments to set (without node and script path).
 */
function setArgv(args: string[]) {
	process.argv = ['node', 'test-cli', ...args];
}

describe('parseCli', () => {
	let originalArgv: string[];
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		originalArgv = process.argv;
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit called');
		});
	});

	afterEach(() => {
		process.argv = originalArgv;
		exitSpy.mockRestore();
	});

	it('parses a known command', () => {
		setArgv(['crawl', 'https://example.com']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('crawl');
	});

	it('extracts positional arguments', () => {
		setArgv(['crawl', 'https://example.com']);
		const result = parseCli(testSettings);
		expect(result.args).toContain('https://example.com');
	});

	it('parses number flag with default', () => {
		setArgv(['crawl', 'https://example.com']);
		const result = parseCli(testSettings);
		if (result.command === 'crawl') {
			expect(result.flags.depth).toBe(10);
		}
	});

	it('parses explicit number flag value', () => {
		setArgv(['crawl', '--depth', '5']);
		const result = parseCli(testSettings);
		if (result.command === 'crawl') {
			expect(result.flags.depth).toBe(5);
		}
	});

	it('parses short flag alias', () => {
		setArgv(['crawl', '-d', '3']);
		const result = parseCli(testSettings);
		if (result.command === 'crawl') {
			expect(result.flags.depth).toBe(3);
		}
	});

	it('parses boolean flag', () => {
		setArgv(['crawl', '--verbose']);
		const result = parseCli(testSettings);
		if (result.command === 'crawl') {
			expect(result.flags.verbose).toBe(true);
		}
	});

	it('parses string flag', () => {
		setArgv(['crawl', '--url', 'https://test.com']);
		const result = parseCli(testSettings);
		if (result.command === 'crawl') {
			expect(result.flags.url).toBe('https://test.com');
		}
	});

	it('returns empty flags for command without flags', () => {
		setArgv(['analyze']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('analyze');
		expect(result.flags).toEqual({});
	});

	it('calls process.exit(1) for unknown command', () => {
		setArgv(['unknown']);
		expect(() => parseCli(testSettings)).toThrow('process.exit called');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('calls process.exit(1) when no command specified', () => {
		setArgv([]);
		expect(() => parseCli(testSettings)).toThrow('process.exit called');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('calls onError when command is missing', () => {
		setArgv([]);
		expect(() => parseCli(testSettings)).toThrow('process.exit called');
		expect(testSettings.onError).toHaveBeenCalled();
	});

	it('calls process.exit(0) for --help flag', () => {
		setArgv(['crawl', '--help']);
		expect(() => parseCli(testSettings)).toThrow('process.exit called');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('calls process.exit(0) for -h flag', () => {
		setArgv(['crawl', '-h']);
		expect(() => parseCli(testSettings)).toThrow('process.exit called');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('preserves positional args when boolean flag precedes them', () => {
		setArgv(['crawl', '--verbose', 'https://example.com']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('crawl');
		expect(result.args).toContain('https://example.com');
		if (result.command === 'crawl') {
			expect(result.flags.verbose).toBe(true);
		}
	});

	it('preserves positional args when short boolean flag precedes them', () => {
		setArgv(['crawl', '-v', 'https://example.com']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('crawl');
		expect(result.args).toContain('https://example.com');
		if (result.command === 'crawl') {
			expect(result.flags.verbose).toBe(true);
		}
	});

	it('preserves positional args with multiple flags mixed', () => {
		setArgv([
			'crawl',
			'--verbose',
			'--depth',
			'5',
			'https://example.com',
			'https://test.com',
		]);
		const result = parseCli(testSettings);
		expect(result.command).toBe('crawl');
		expect(result.args).toEqual(['https://example.com', 'https://test.com']);
		if (result.command === 'crawl') {
			expect(result.flags.verbose).toBe(true);
			expect(result.flags.depth).toBe(5);
		}
	});

	it('returns positional args for command without flags', () => {
		setArgv(['analyze', 'file1.html', 'file2.html']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('analyze');
		expect(result.args).toEqual(['file1.html', 'file2.html']);
	});

	it('treats args after -- as positional', () => {
		setArgv(['crawl', '--verbose', '--', '--not-a-flag']);
		const result = parseCli(testSettings);
		expect(result.command).toBe('crawl');
		expect(result.args).toContain('--not-a-flag');
		if (result.command === 'crawl') {
			expect(result.flags.verbose).toBe(true);
		}
	});

	describe('version flag', () => {
		let logSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		});

		afterEach(() => {
			logSpy.mockRestore();
		});

		it('prints version and exits 0 for --version when version is set', () => {
			setArgv(['--version']);
			expect(() => parseCli({ ...testSettings, version: '1.2.3' })).toThrow(
				'process.exit called',
			);
			expect(logSpy).toHaveBeenCalledWith('1.2.3');
			expect(exitSpy).toHaveBeenCalledWith(0);
		});

		it('prints version and exits 0 for -v when version is set', () => {
			setArgv(['-v']);
			expect(() => parseCli({ ...testSettings, version: '1.2.3' })).toThrow(
				'process.exit called',
			);
			expect(logSpy).toHaveBeenCalledWith('1.2.3');
			expect(exitSpy).toHaveBeenCalledWith(0);
		});

		it('does not treat -v as version when version is unset', () => {
			setArgv(['-v']);
			expect(() => parseCli(testSettings)).toThrow('process.exit called');
			expect(logSpy).not.toHaveBeenCalled();
			expect(exitSpy).toHaveBeenCalledWith(1);
		});

		it('does not intercept -v used as a per-command short flag', () => {
			setArgv(['crawl', '-v']);
			const result = parseCli({ ...testSettings, version: '1.2.3' });
			expect(result.command).toBe('crawl');
			expect(logSpy).not.toHaveBeenCalled();
			if (result.command === 'crawl') {
				expect(result.flags.verbose).toBe(true);
			}
		});

		it('does not intercept --version after a command', () => {
			setArgv(['crawl', '--version']);
			const result = parseCli({ ...testSettings, version: '1.2.3' });
			expect(result.command).toBe('crawl');
			expect(logSpy).not.toHaveBeenCalled();
		});

		it('prints version when --version is followed by extra positional args', () => {
			setArgv(['--version', 'extra']);
			expect(() => parseCli({ ...testSettings, version: '1.2.3' })).toThrow(
				'process.exit called',
			);
			expect(logSpy).toHaveBeenCalledWith('1.2.3');
			expect(exitSpy).toHaveBeenCalledWith(0);
		});

		it('treats empty-string version as a valid version (prints empty line)', () => {
			setArgv(['-v']);
			expect(() => parseCli({ ...testSettings, version: '' })).toThrow(
				'process.exit called',
			);
			expect(logSpy).toHaveBeenCalledWith('');
			expect(exitSpy).toHaveBeenCalledWith(0);
		});
	});
});
