import yargsParser from 'yargs-parser';

// ---- Flag definition types ----

/**
 * Definition for a string-typed CLI flag.
 * @example
 * ```ts
 * const flag: StringFlag = {
 *   type: 'string',
 *   shortFlag: 'u',
 *   desc: 'Target URL',
 *   isRequired: true,
 * };
 * ```
 */
interface StringFlag {
	readonly type: 'string';
	/** Single-character alias (e.g. `'u'` for `-u`). */
	readonly shortFlag?: string;
	/** Description shown in `--help` output. */
	readonly desc?: string;
	/** Default value applied when the flag is omitted. */
	readonly default?: string;
	/** When `true`, the flag accepts multiple values and produces a `string[]`. */
	readonly isMultiple?: boolean;
	/** When `true`, the CLI exits with an error if this flag is omitted. */
	readonly isRequired?: boolean;
}

/**
 * Definition for a number-typed CLI flag.
 */
interface NumberFlag {
	readonly type: 'number';
	/** Single-character alias. */
	readonly shortFlag?: string;
	/** Description shown in `--help` output. */
	readonly desc?: string;
	/** Default value applied when the flag is omitted. */
	readonly default?: number;
	/** When `true`, the flag accepts multiple values and produces a `number[]`. */
	readonly isMultiple?: boolean;
}

/**
 * Definition for a boolean-typed CLI flag.
 * Boolean flags do not accept values; their presence sets them to `true`.
 */
interface BooleanFlag {
	readonly type: 'boolean';
	/** Single-character alias. */
	readonly shortFlag?: string;
	/** Description shown in `--help` output. */
	readonly desc?: string;
	/** Default value applied when the flag is omitted. */
	readonly default?: boolean;
}

/** Union of all flag definition types. */
type FlagDef = StringFlag | NumberFlag | BooleanFlag;

/** A record of named flag definitions for a command. */
type AnyFlags = Record<string, FlagDef>;

// ---- Inferred flag value types ----

/**
 * Infers the runtime TypeScript type for a single flag definition.
 * Handles all combinations of `type`, `isMultiple`, `default`, and `isRequired`.
 *
 * WHY: This conditional type tree ensures that the parsed flags object
 * has precise types, so commands get type-safe access to their flags
 * without manual casting.
 */
type InferFlagValue<F extends FlagDef> = F extends { type: 'string'; isMultiple: true }
	? string[]
	: F extends { type: 'string'; default: string }
		? string
		: F extends { type: 'string'; isRequired: true }
			? string
			: F extends { type: 'string' }
				? string | undefined
				: F extends { type: 'number'; isMultiple: true }
					? number[]
					: F extends { type: 'number'; default: number }
						? number
						: F extends { type: 'number' }
							? number | undefined
							: F extends { type: 'boolean'; default: boolean }
								? boolean
								: F extends { type: 'boolean' }
									? boolean | undefined
									: never;

/**
 * Maps a flags definition record to its runtime value types.
 * Used in {@link RoarResult} to type the `flags` property of each command.
 */
export type InferFlags<F extends AnyFlags> = {
	-readonly [K in keyof F]: InferFlagValue<F[K]>;
};

// ---- Command definition ----

/**
 * Defines a single CLI sub-command with its description and optional flags.
 * @template F - Flag definitions record for this command
 * @example
 * ```ts
 * const crawlCommand = {
 *   desc: 'Crawl a website',
 *   flags: {
 *     depth: { type: 'number' as const, shortFlag: 'd', desc: 'Max crawl depth', default: 10 },
 *     verbose: { type: 'boolean' as const, shortFlag: 'v', desc: 'Enable verbose output' },
 *   },
 * } satisfies CommandDef;
 * ```
 */
export interface CommandDef<F extends AnyFlags = AnyFlags> {
	/** Human-readable description of the command. */
	readonly desc: string;
	/** Flag definitions. When omitted, the command accepts no flags. */
	readonly flags?: F;
}

// ---- Settings and result types ----

/**
 * Configuration object passed to {@link parseCli}.
 * @template Commands - Record of command name to {@link CommandDef}
 */
interface RoarSettings<Commands extends Record<string, CommandDef>> {
	/** CLI program name shown in help text (e.g. `"my-cli"`). */
	name: string;
	/**
	 * Program version string (e.g. `"1.2.3"`).
	 * When provided, the CLI prints this value and exits with code `0`
	 * if the first argument is `-v` or `--version`.
	 */
	version?: string;
	/** Map of sub-command names to their definitions. */
	commands: Commands;
	/**
	 * Called when no command or an unknown command is specified.
	 * Return `true` to print help text to stderr before exiting.
	 */
	onError?: (error: Error) => boolean;
}

/**
 * Discriminated union of all possible parse results.
 * The `command` field narrows the union so that `flags` is
 * correctly typed for the matched command.
 * @template Commands - Record of command name to {@link CommandDef}
 */
type RoarResult<Commands extends Record<string, CommandDef>> = {
	[K in keyof Commands & string]: {
		/** The matched command name. */
		command: K;
		/** Positional arguments that follow the command name. */
		args: string[];
		/** Parsed and typed flag values for this command. */
		flags: Commands[K] extends CommandDef<infer F>
			? InferFlags<F>
			: Record<string, never>;
	};
}[keyof Commands & string];

// ---- Help text generation ----

/**
 * Converts a camelCase string to kebab-case for CLI flag display.
 * @param str - camelCase identifier (e.g. `"maxDepth"`)
 * @returns kebab-case string (e.g. `"max-depth"`)
 */
function camelToKebab(str: string): string {
	return str.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Generates the top-level help text listing all available commands.
 * @param settings - The roar settings containing program name and commands
 * @returns Formatted multi-line help string
 */
function generateHelp<Commands extends Record<string, CommandDef>>(
	settings: RoarSettings<Commands>,
): string {
	const lines: string[] = [
		`Usage: ${settings.name} <command> [options]`,
		'',
		'Commands:',
	];

	for (const [name, def] of Object.entries(settings.commands)) {
		lines.push(`  ${name.padEnd(16)} ${def.desc}`);
	}

	return lines.join('\n');
}

/**
 * Generates per-command help text listing all available flags
 * with their short aliases, descriptions, and defaults.
 * @param name - CLI program name
 * @param commandName - The sub-command name
 * @param flags - Flag definitions for the command
 * @returns Formatted multi-line help string
 */
function generateCommandHelp<F extends AnyFlags>(
	name: string,
	commandName: string,
	flags: F,
): string {
	const lines: string[] = [`Usage: ${name} ${commandName} [options]`, '', 'Options:'];

	for (const [key, def] of Object.entries(flags)) {
		const kebab = camelToKebab(key);
		const short = def.shortFlag ? `-${def.shortFlag}, ` : '    ';
		const flagStr = `${short}--${kebab}`;
		const desc = def.desc ?? '';
		const defaultStr =
			'default' in def && def.default !== undefined ? ` (default: ${def.default})` : '';
		lines.push(`  ${flagStr.padEnd(30)} ${desc}${defaultStr}`);
	}

	return lines.join('\n');
}

// ---- Core parser ----

/**
 * Parses command-line arguments against the given flag definitions
 * using yargs-parser.
 *
 * WHY yargs-parser: It handles camelCase expansion, alias stripping,
 * and type coercion out of the box, which avoids reimplementing
 * these common CLI parsing concerns.
 * @param argv - Raw argument strings (after removing the command name)
 * @param flags - Flag definitions that drive parsing configuration
 * @returns Object containing typed flag values and positional arguments
 */
function parseFlags<F extends AnyFlags>(
	argv: string[],
	flags: F,
): { flags: InferFlags<F>; args: string[] } {
	const alias: Record<string, string> = {};
	const boolean: string[] = [];
	const string: string[] = [];
	const number: string[] = [];
	const array: string[] = [];
	const defaults: Record<string, unknown> = {};

	for (const [key, def] of Object.entries(flags)) {
		if (def.shortFlag) {
			alias[key] = def.shortFlag;
		}
		switch (def.type) {
			case 'boolean': {
				boolean.push(key);

				break;
			}
			case 'string': {
				string.push(key);

				break;
			}
			case 'number': {
				number.push(key);

				break;
			}
			// No default
		}
		if ('isMultiple' in def && def.isMultiple) {
			array.push(key);
		}
		if ('default' in def && def.default !== undefined) {
			defaults[key] = def.default;
		}
	}

	const parsed = yargsParser(argv, {
		alias,
		boolean,
		string,
		number,
		array,
		default: defaults,
		configuration: {
			'camel-case-expansion': true,
			'strip-aliased': true,
			'strip-dashed': true,
		},
	});

	const result: Record<string, unknown> = {};

	for (const key of Object.keys(flags)) {
		result[key] = parsed[key] ?? defaults[key];
	}

	return { flags: result as InferFlags<F>, args: parsed._.map(String) };
}

// ---- Main export ----

/**
 * Parses `process.argv` and returns the matched command with typed flags.
 *
 * A minimal CLI framework built on yargs-parser. It provides:
 * - Sub-command dispatch with typed flag inference
 * - Automatic `--help` / `-h` handling per command
 * - Automatic `--version` / `-v` handling at the top level when `version` is set
 * - camelCase flag names converted to kebab-case in help text
 * @template Commands - Record of command name to {@link CommandDef}
 * @param settings - CLI program configuration
 * @returns Parsed result with the matched command name, positional args, and typed flags
 * @example
 * ```ts
 * const result = parseCli({
 *   name: 'my-cli',
 *   commands: {
 *     crawl: {
 *       desc: 'Crawl a website',
 *       flags: {
 *         depth: { type: 'number', shortFlag: 'd', desc: 'Max depth', default: 10 },
 *       },
 *     },
 *     analyze: {
 *       desc: 'Run analyze plugins',
 *     },
 *   },
 *   onError: () => true,
 * });
 *
 * if (result.command === 'crawl') {
 *   console.log(result.flags.depth); // number (inferred)
 * }
 * ```
 */
export function parseCli<const Commands extends Record<string, CommandDef>>(
	settings: RoarSettings<Commands>,
): RoarResult<Commands> {
	const argv = process.argv.slice(2);
	const command = argv[0];

	if (settings.version !== undefined && (command === '-v' || command === '--version')) {
		// eslint-disable-next-line no-console
		console.log(settings.version);
		process.exit(0);
	}

	if (!command || !(command in settings.commands)) {
		if (settings.onError) {
			const showHelp = settings.onError(new Error('No command specified'));
			if (showHelp) {
				// eslint-disable-next-line no-console
				console.error(generateHelp(settings));
			}
		}
		process.exit(1);
	}

	const commandDef = settings.commands[command as keyof Commands & string];
	if (!commandDef) {
		process.exit(1);
	}
	const commandArgv = argv.slice(1);

	if (commandArgv.includes('--help') || commandArgv.includes('-h')) {
		// eslint-disable-next-line no-console
		console.log(generateCommandHelp(settings.name, command, commandDef.flags ?? {}));
		process.exit(0);
	}

	const { flags, args } = commandDef.flags
		? parseFlags(commandArgv, commandDef.flags)
		: { flags: {}, args: yargsParser(commandArgv)._.map(String) };

	return {
		command,
		args,
		flags,
	} as RoarResult<Commands>;
}
