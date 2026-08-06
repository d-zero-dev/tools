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

	describe('help rendering', () => {
		let logSpy: ReturnType<typeof vi.spyOn>;
		let errorSpy: ReturnType<typeof vi.spyOn>;

		const helpSettings = {
			name: 'npx @test/cli',
			commands: {
				crawl: {
					desc: 'Crawl a website',
					usage: ['<URL> [<URL>...] [options]', '<archive> --append <URL> [options]'],
					flags: {
						append: {
							type: 'string' as const,
							shortFlag: 'A',
							desc: 'Append crawl',
							valueName: 'URL',
							group: 'Crawl modes',
							isMultiple: true,
						},
						interval: {
							type: 'number' as const,
							shortFlag: 'I',
							desc: 'Interval between requests',
							valueName: 'ms',
						},
						imageFileSizeThreshold: {
							type: 'number' as const,
							desc: 'Image file size threshold',
						},
						verbose: { type: 'boolean' as const, desc: 'Verbose output' },
					},
				},
				query: {
					desc: 'Query an archive',
					usage: '<file> <sub-command> [options]',
					flags: {
						limit: {
							type: 'number' as const,
							shortFlag: 'l',
							desc: 'Maximum number of results',
						},
						url: { type: 'string' as const, desc: 'Target URL', valueName: 'URL' },
						pretty: { type: 'boolean' as const, desc: 'Pretty-print JSON output' },
					},
					subCommands: {
						pages: {
							desc: 'List pages',
							usage: '<file> pages [options]',
							flags: ['limit'] as const,
						},
						'page-detail': {
							desc: 'Show a single page',
							flags: ['url'] as const,
						},
					},
				},
			},
			onError: vi.fn().mockReturnValue(true),
		} as const;

		/**
		 * Returns everything printed via console.log joined together.
		 */
		function loggedText(): string {
			return logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
		}

		beforeEach(() => {
			logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
			errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		});

		afterEach(() => {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it('prints top-level help to stdout and exits 0 for --help', () => {
			setArgv(['--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			expect(exitSpy).toHaveBeenCalledWith(0);
			expect(errorSpy).not.toHaveBeenCalled();
			const text = loggedText();
			expect(text).toContain('Usage: npx @test/cli <command> [options]');
			expect(text).toContain('crawl');
			expect(text).toContain('Crawl a website');
			expect(text).toContain("Run 'npx @test/cli <command> --help'");
		});

		it('prints top-level help to stdout and exits 0 for -h', () => {
			setArgv(['-h']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			expect(exitSpy).toHaveBeenCalledWith(0);
			expect(loggedText()).toContain('Commands:');
		});

		it('still reports an error for a missing command', () => {
			setArgv([]);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			expect(exitSpy).toHaveBeenCalledWith(1);
			expect(errorSpy).toHaveBeenCalled();
		});

		it('renders every usage entry with the program and command prefix', () => {
			setArgv(['crawl', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('Usage: npx @test/cli crawl <URL> [<URL>...] [options]');
			expect(text).toContain(
				'       npx @test/cli crawl <archive> --append <URL> [options]',
			);
		});

		it('falls back to a generic usage line when usage is omitted', () => {
			setArgv(['crawl', '--help']);
			expect(() =>
				parseCli({
					...helpSettings,
					commands: { crawl: { desc: 'Crawl', flags: {} } },
				}),
			).toThrow('process.exit called');
			expect(loggedText()).toContain('Usage: npx @test/cli crawl [options]');
		});

		it('renders value placeholders for string and number flags', () => {
			setArgv(['crawl', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('-A, --append <URL>...');
			expect(text).toContain('-I, --interval <ms>');
			expect(text).toContain('--image-file-size-threshold <n>');
			expect(text).not.toContain('--verbose <');
		});

		it('renders grouped flags under their own section heading', () => {
			setArgv(['crawl', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('Crawl modes:');
			const optionsIndex = text.indexOf('Options:');
			const groupIndex = text.indexOf('Crawl modes:');
			expect(optionsIndex).toBeGreaterThanOrEqual(0);
			expect(groupIndex).toBeGreaterThan(optionsIndex);
		});

		it('lists sub-commands and hides sub-command-specific flags in command help', () => {
			setArgv(['query', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('Sub-commands:');
			expect(text).toContain('pages');
			expect(text).toContain('List pages');
			expect(text).toContain('--pretty');
			expect(text).not.toContain('--limit');
			expect(text).not.toContain('--url');
			expect(text).toContain("Run 'npx @test/cli query <sub-command> --help'");
		});

		it('filters help to the requested sub-command plus common flags', () => {
			setArgv(['query', 'archive.db', 'pages', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('Usage: npx @test/cli query <file> pages [options]');
			expect(text).toContain('List pages');
			expect(text).toContain('--limit');
			expect(text).toContain('--pretty');
			expect(text).not.toContain('--url');
		});

		it('applies every flag to a sub-command whose flags list is omitted', () => {
			setArgv(['query', 'archive.db', 'all-flags', '--help']);
			expect(() =>
				parseCli({
					...helpSettings,
					commands: {
						query: {
							desc: 'Query an archive',
							flags: {
								limit: { type: 'number' as const, desc: 'Maximum number of results' },
								url: { type: 'string' as const, desc: 'Target URL' },
							},
							subCommands: {
								'all-flags': { desc: 'Sub-command without a flags list' },
							},
						},
					},
				}),
			).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('--limit');
			expect(text).toContain('--url');
		});

		it('omits the Options heading when every flag is grouped', () => {
			setArgv(['crawl', '--help']);
			expect(() =>
				parseCli({
					...helpSettings,
					commands: {
						crawl: {
							desc: 'Crawl',
							flags: {
								append: {
									type: 'string' as const,
									desc: 'Append crawl',
									group: 'Crawl modes',
								},
								output: {
									type: 'string' as const,
									desc: 'Output file path',
									group: 'Output',
								},
							},
						},
					},
				}),
			).toThrow('process.exit called');
			const text = loggedText();
			expect(text).not.toContain('Options:');
			const modesIndex = text.indexOf('Crawl modes:');
			const outputIndex = text.indexOf('Output:');
			expect(modesIndex).toBeGreaterThanOrEqual(0);
			expect(outputIndex).toBeGreaterThan(modesIndex);
		});

		it('renders an over-cap label on its own line with the description below', () => {
			setArgv(['crawl', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const lines = loggedText().split('\n');
			const labelLineIndex = lines.findIndex((line) =>
				line.includes('--image-file-size-threshold <n>'),
			);
			expect(labelLineIndex).toBeGreaterThanOrEqual(0);
			expect(lines[labelLineIndex]).not.toContain('Image file size threshold');
			expect(lines[labelLineIndex + 1]).toContain('Image file size threshold');
		});

		it('falls back to a generic sub-command usage line when omitted', () => {
			setArgv(['query', 'archive.db', 'page-detail', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			const text = loggedText();
			expect(text).toContain('Usage: npx @test/cli query page-detail [options]');
			expect(text).toContain('--url');
			expect(text).not.toContain('--limit');
		});

		it('shows full command help when --help is used with an unknown sub-command', () => {
			setArgv(['query', 'archive.db', '--help']);
			expect(() => parseCli(helpSettings)).toThrow('process.exit called');
			expect(loggedText()).toContain('Sub-commands:');
		});

		it('wraps long descriptions instead of emitting one long line', () => {
			setArgv(['crawl', '--help']);
			const longDesc =
				'Same-cluster soft cap: stop enqueueing newly-discovered internal URLs whose shape has accumulated this many matching-title observations and see the events query for what fired.';
			expect(() =>
				parseCli({
					...helpSettings,
					commands: {
						crawl: {
							desc: 'Crawl',
							flags: {
								dedupeCap: { type: 'number' as const, desc: longDesc },
							},
						},
					},
				}),
			).toThrow('process.exit called');
			const lines = loggedText().split('\n');
			expect(lines.some((line) => line.includes('Same-cluster soft cap'))).toBe(true);
			for (const line of lines) {
				expect(line.length).toBeLessThanOrEqual(100);
			}
		});
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
