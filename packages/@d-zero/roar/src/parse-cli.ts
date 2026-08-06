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
 *   valueName: 'URL',
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
	/**
	 * Value placeholder shown in `--help` output (e.g. `'URL'` renders
	 * `--url <URL>`). Defaults to `'value'` when omitted.
	 */
	readonly valueName?: string;
	/**
	 * Section heading this flag is listed under in `--help` output.
	 * Flags without a group are listed first under `Options:`.
	 */
	readonly group?: string;
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
	/**
	 * Value placeholder shown in `--help` output (e.g. `'ms'` renders
	 * `--interval <ms>`). Defaults to `'n'` when omitted.
	 */
	readonly valueName?: string;
	/**
	 * Section heading this flag is listed under in `--help` output.
	 * Flags without a group are listed first under `Options:`.
	 */
	readonly group?: string;
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
	/**
	 * Section heading this flag is listed under in `--help` output.
	 * Flags without a group are listed first under `Options:`.
	 */
	readonly group?: string;
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
 * Help-only metadata for a sub-command nested under a command
 * (e.g. `my-cli query pages`).
 *
 * roar does not parse or dispatch sub-commands — the host CLI keeps
 * receiving them as positional arguments and dispatches on its own.
 * This metadata only drives `--help` rendering: the command help lists
 * sub-commands, and `my-cli <command> <sub-command> --help` renders a
 * help page filtered to the flags that apply to that sub-command.
 * @template F - Flag definitions record of the parent command
 * @example
 * ```ts
 * const pagesSubCommand: SubCommandDef = {
 *   desc: 'List pages in the archive',
 *   usage: '<file> pages [options]',
 *   flags: ['limit', 'offset', 'status'],
 * };
 * ```
 */
export interface SubCommandDef<F extends AnyFlags = AnyFlags> {
	/** Human-readable description shown in the sub-command list. */
	readonly desc: string;
	/**
	 * Usage line(s) for this sub-command's filtered help, written relative
	 * to the program name and command name (both are prepended automatically).
	 * When omitted, a generic `<sub-command> [options]` line is rendered.
	 */
	readonly usage?: string | readonly string[];
	/**
	 * Keys of the parent command's `flags` that apply to this sub-command.
	 * Flags not referenced by any sub-command are treated as common to all
	 * sub-commands and always shown. When omitted, every flag applies.
	 */
	readonly flags?: readonly (keyof F & string)[];
}

/**
 * Defines a single CLI sub-command with its description and optional flags.
 * @template F - Flag definitions record for this command
 * @example
 * ```ts
 * const crawlCommand = {
 *   desc: 'Crawl a website',
 *   usage: ['<URL> [<URL>...] [options]', '<archive> --append <URL> [options]'],
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
	/**
	 * Usage line(s) shown in `--help`, written relative to the program name
	 * and command name (both are prepended automatically). Multiple entries
	 * render one `Usage:` block line each — useful for mutually exclusive
	 * invocation modes. When omitted, a generic `[options]` line is rendered.
	 */
	readonly usage?: string | readonly string[];
	/** Flag definitions. When omitted, the command accepts no flags. */
	readonly flags?: F;
	/**
	 * Help-only sub-command metadata. See {@link SubCommandDef} for how it
	 * changes `--help` rendering. Parsing behaviour is unaffected.
	 */
	readonly subCommands?: Readonly<Record<string, SubCommandDef<F>>>;
}

// ---- Settings and result types ----

/**
 * Configuration object passed to {@link parseCli}.
 * @template Commands - Record of command name to {@link CommandDef}
 */
interface RoarSettings<Commands extends Record<string, CommandDef>> {
	/**
	 * CLI program name shown in help text. Use the canonical invocation
	 * (e.g. the full `npx`-prefixed command for a scoped package) rather
	 * than the bare binary name when the CLI is not expected to be on `PATH`.
	 */
	name: string;
	/**
	 * Program version string (e.g. `"1.2.3"`).
	 * When provided, the CLI prints this value and exits with code `0`
	 * if the first argument is `-v` or `--version`.
	 *
	 * 判定は `argv[0]` の位置でのみ行われる。サブコマンドの後ろ（例: `my-cli build -v`）
	 * に置いた場合はそのコマンドが定義した `shortFlag: 'v'` のフラグとして解釈され、
	 * バージョン表示は発火しない。これはサブコマンド固有の `-v` を奪わないための仕様。
	 *
	 * 空文字列 `''` を設定した場合も「version が指定された」と扱われ、空行を出力して
	 * `exit(0)` する（`undefined` のみが「未指定」を意味する）。
	 */
	version?: string;
	/** Map of sub-command names to their definitions. */
	commands: Commands;
	/**
	 * Called when no command or an unknown command is specified.
	 * Return `true` to print help text to stderr before exiting.
	 *
	 * `--help` / `-h` as the first argument is not an error: it prints the
	 * same help to stdout and exits with code `0` without calling this.
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
 * Layout constants for help rendering.
 *
 * WHY a max width: unbounded lines follow the terminal width, which makes
 * long flag descriptions unreadable on wide displays; 100 columns keeps
 * the text measure comfortable while still using wide terminals.
 * WHY a label column cap: a single long flag (e.g.
 * `--image-file-size-threshold <bytes>`) must not push every description
 * across the screen — over-long labels get their own line instead.
 */
const HELP_MAX_WIDTH = 100;
const HELP_MIN_WIDTH = 40;
const LABEL_COLUMN_CAP = 32;
const INDENT = '  ';
const COLUMN_GAP = '  ';

/**
 * Resolves the effective help width from the current terminal.
 * @returns Column count clamped to a readable range
 */
function helpWidth(): number {
	const columns = process.stdout.columns ?? 80;
	return Math.min(Math.max(columns, HELP_MIN_WIDTH), HELP_MAX_WIDTH);
}

/**
 * Wraps text at word boundaries to fit the given width.
 * @param text - Text to wrap (single logical line)
 * @param width - Maximum characters per line (at least one word per line)
 * @returns Wrapped lines; `['']` for empty text so callers always get a line
 */
function wrapText(text: string, width: number): string[] {
	const words = text.split(' ').filter((word) => word.length > 0);
	if (words.length === 0) {
		return [''];
	}
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		if (current.length === 0) {
			current = word;
		} else if (current.length + 1 + word.length <= width) {
			current += ` ${word}`;
		} else {
			lines.push(current);
			current = word;
		}
	}
	lines.push(current);
	return lines;
}

/** A single label/description row in a two-column help section. */
interface HelpRow {
	readonly label: string;
	readonly desc: string;
}

/**
 * Renders label/description rows as two aligned columns.
 *
 * The label column width adapts to the longest label, capped at
 * {@link LABEL_COLUMN_CAP}; labels beyond the cap are rendered on their own
 * line with the description continuing on the next line. Descriptions wrap
 * at the terminal width with a hanging indent aligned to the description
 * column.
 * @param rows - Rows to render
 * @returns Formatted lines
 */
function renderRows(rows: readonly HelpRow[]): string[] {
	const labelWidth = Math.min(
		Math.max(...rows.map((row) => row.label.length), 0),
		LABEL_COLUMN_CAP,
	);
	const descColumn = INDENT.length + labelWidth + COLUMN_GAP.length;
	const descWidth = Math.max(helpWidth() - descColumn, 20);
	const lines: string[] = [];
	for (const row of rows) {
		const descLines = wrapText(row.desc, descWidth);
		if (row.label.length > labelWidth) {
			lines.push(`${INDENT}${row.label}`);
			for (const descLine of descLines) {
				if (descLine.length > 0) {
					lines.push(`${' '.repeat(descColumn)}${descLine}`);
				}
			}
			continue;
		}
		const [first = '', ...rest] = descLines;
		const firstLine = `${INDENT}${row.label.padEnd(labelWidth)}${COLUMN_GAP}${first}`;
		lines.push(firstLine.trimEnd());
		for (const descLine of rest) {
			lines.push(`${' '.repeat(descColumn)}${descLine}`);
		}
	}
	return lines;
}

/**
 * Converts a camelCase string to kebab-case for CLI flag display.
 * @param str - camelCase identifier (e.g. `"maxDepth"`)
 * @returns kebab-case string (e.g. `"max-depth"`)
 */
function camelToKebab(str: string): string {
	return str.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Builds the label column text for a flag (short alias, long name, and
 * value placeholder).
 * @param key - camelCase flag key
 * @param def - Flag definition
 * @returns Label such as `-I, --interval <ms>` or `    --verbose`
 */
function flagLabel(key: string, def: FlagDef): string {
	const kebab = camelToKebab(key);
	const short = def.shortFlag ? `-${def.shortFlag}, ` : '    ';
	let label = `${short}--${kebab}`;
	if (def.type !== 'boolean') {
		const valueName = def.valueName ?? (def.type === 'number' ? 'n' : 'value');
		label += ` <${valueName}>`;
		if ('isMultiple' in def && def.isMultiple) {
			label += '...';
		}
	}
	return label;
}

/**
 * Builds the description column text for a flag (description plus
 * default-value suffix).
 * @param def - Flag definition
 * @returns Description such as `Number of parallel scraping (default: 3)`
 */
function flagDesc(def: FlagDef): string {
	const desc = def.desc ?? '';
	const defaultStr =
		'default' in def && def.default !== undefined ? ` (default: ${def.default})` : '';
	return `${desc}${defaultStr}`.trim();
}

/**
 * Renders flags as grouped two-column sections. Ungrouped flags come first
 * under `Options:`; grouped flags follow under their `group` heading in
 * first-appearance order.
 * @param flags - Flag definitions to render
 * @param keys - Flag keys to include, in definition order
 * @returns Formatted lines including section headings
 */
function renderFlagSections<F extends AnyFlags>(
	flags: F,
	keys: readonly string[],
): string[] {
	const sections = new Map<string, HelpRow[]>();
	for (const key of keys) {
		const def = flags[key];
		if (!def) {
			continue;
		}
		const group = def.group ?? 'Options';
		const rows = sections.get(group) ?? [];
		rows.push({ label: flagLabel(key, def), desc: flagDesc(def) });
		sections.set(group, rows);
	}
	const lines: string[] = [];
	const ungrouped = sections.get('Options');
	if (ungrouped) {
		lines.push('Options:', ...renderRows(ungrouped));
	}
	for (const [group, rows] of sections) {
		if (group === 'Options') {
			continue;
		}
		if (lines.length > 0) {
			lines.push('');
		}
		lines.push(`${group}:`, ...renderRows(rows));
	}
	return lines;
}

/**
 * Renders a `Usage:` block from usage entries, prepending the given prefix
 * (program name and command name) to each entry.
 * @param prefix - Invocation prefix (e.g. `"my-cli crawl"`)
 * @param usage - Usage entries relative to the prefix
 * @returns Formatted lines
 */
function renderUsage(prefix: string, usage: readonly string[]): string[] {
	return usage.map((entry, index) =>
		index === 0 ? `Usage: ${prefix} ${entry}` : `       ${prefix} ${entry}`,
	);
}

/**
 * Normalizes a `string | readonly string[]` usage value to an array.
 * @param usage - Usage value from a command or sub-command definition
 * @param fallback - Entry used when the definition has no usage
 * @returns Usage entries
 */
function usageEntries(
	usage: string | readonly string[] | undefined,
	fallback: string,
): readonly string[] {
	if (usage === undefined) {
		return [fallback];
	}
	return typeof usage === 'string' ? [usage] : usage;
}

/**
 * Collects the flag keys that are common to all sub-commands: keys not
 * referenced by any sub-command's `flags` list.
 *
 * WHY implicit: listing common flags (e.g. `--pretty`) on every one of
 * dozens of sub-commands would be pure noise in the definitions; a flag
 * that no sub-command claims is by definition sub-command-agnostic.
 * @param def - Command definition with sub-commands
 * @returns Common flag keys in definition order
 */
function commonFlagKeys(def: CommandDef): string[] {
	const referenced = new Set<string>();
	for (const sub of Object.values(def.subCommands ?? {})) {
		for (const key of sub.flags ?? []) {
			referenced.add(key);
		}
	}
	return Object.keys(def.flags ?? {}).filter((key) => !referenced.has(key));
}

/**
 * Generates the top-level help text listing all available commands.
 * @param settings - The roar settings containing program name and commands
 * @returns Formatted multi-line help string
 */
function generateHelp<Commands extends Record<string, CommandDef>>(
	settings: RoarSettings<Commands>,
): string {
	const rows: HelpRow[] = Object.entries(settings.commands).map(([name, def]) => ({
		label: name,
		desc: def.desc,
	}));
	return [
		`Usage: ${settings.name} <command> [options]`,
		'',
		'Commands:',
		...renderRows(rows),
		'',
		`Run '${settings.name} <command> --help' for details on a command.`,
	].join('\n');
}

/**
 * Generates per-command help text.
 *
 * Three shapes depending on the definition and the requested scope:
 * - Plain command: usage block plus all flags in grouped sections.
 * - Command with `subCommands`, no sub-command requested: usage block,
 *   sub-command list, and only the flags common to all sub-commands,
 *   with a hint pointing at per-sub-command help.
 * - Sub-command requested: the sub-command's usage block and the flags
 *   that apply to it (its own list plus the common flags).
 * @param settings - The roar settings containing the program name
 * @param commandName - The command name
 * @param def - The command definition
 * @param subCommandName - Sub-command to filter help to, when requested
 * @returns Formatted multi-line help string
 */
function generateCommandHelp<Commands extends Record<string, CommandDef>>(
	settings: RoarSettings<Commands>,
	commandName: string,
	def: CommandDef,
	subCommandName?: string,
): string {
	const prefix = `${settings.name} ${commandName}`;
	const flags = def.flags ?? {};
	const allKeys = Object.keys(flags);

	const subCommand =
		subCommandName === undefined ? undefined : def.subCommands?.[subCommandName];
	if (subCommand && subCommandName !== undefined) {
		const common = new Set(commonFlagKeys(def));
		const own = new Set(subCommand.flags ?? allKeys);
		const keys = allKeys.filter((key) => own.has(key) || common.has(key));
		const lines = [
			...renderUsage(
				prefix,
				usageEntries(subCommand.usage, `${subCommandName} [options]`),
			),
			'',
			...wrapText(subCommand.desc, helpWidth()),
		];
		if (keys.length > 0) {
			lines.push('', ...renderFlagSections(flags, keys));
		}
		return lines.join('\n');
	}

	const lines = [...renderUsage(prefix, usageEntries(def.usage, '[options]'))];

	if (def.subCommands) {
		const rows: HelpRow[] = Object.entries(def.subCommands).map(([name, sub]) => ({
			label: name,
			desc: sub.desc,
		}));
		lines.push('', 'Sub-commands:', ...renderRows(rows));
		const common = commonFlagKeys(def);
		if (common.length > 0) {
			lines.push('', ...renderFlagSections(flags, common));
		}
		lines.push('', `Run '${prefix} <sub-command> --help' for details on a sub-command.`);
		return lines.join('\n');
	}

	if (allKeys.length > 0) {
		lines.push('', ...renderFlagSections(flags, allKeys));
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
 * - Automatic `--help` / `-h` handling: at the top level it prints the
 *   command list; after a command it prints that command's flags; when the
 *   command defines `subCommands` and a sub-command name is present
 *   (e.g. `my-cli query file.db pages --help`), it prints help filtered
 *   to that sub-command. All help goes to stdout with exit code `0`.
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
 *       usage: '<URL> [options]',
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

	if (command === '--help' || command === '-h') {
		// eslint-disable-next-line no-console
		console.log(generateHelp(settings));
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
		const subCommandName = commandDef.subCommands
			? commandArgv.find(
					(arg) =>
						!arg.startsWith('-') && Object.hasOwn(commandDef.subCommands ?? {}, arg),
				)
			: undefined;
		// eslint-disable-next-line no-console
		console.log(generateCommandHelp(settings, command, commandDef, subCommandName));
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
