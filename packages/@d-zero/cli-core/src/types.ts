import type { DelayOptions } from '@d-zero/shared/delay';
import type { ParsedArgs } from 'minimist';

export interface BaseCLIOptions {
	limit?: number;
	debug?: boolean;
	verbose?: boolean;
	listfile?: string;
	interval?: number | DelayOptions;
}

export interface CLIAlias {
	[key: string]: string;
}

export interface CLIConfig<T extends BaseCLIOptions> {
	/**
	 * Package name for version display
	 */
	name?: string;
	/**
	 * Package version for -v/--version option
	 */
	version?: string;
	aliases?: CLIAlias;
	usage: string[];
	parseArgs: (cli: ParsedArgs) => T;
	validateArgs: (options: T, cli: ParsedArgs) => boolean;
}

export interface ParsedCLI<T extends BaseCLIOptions> {
	options: T;
	args: string[];
	hasConfigFile: boolean;
}
