export interface BaseCLIOptions {
	limit?: number;
	debug?: boolean;
	verbose?: boolean;
	listfile?: string;
}

export interface CLIAlias {
	[key: string]: string;
}

export interface CLIConfig<T extends BaseCLIOptions> {
	aliases?: CLIAlias;
	usage: string[];
	parseArgs: (cli: import('minimist').ParsedArgs) => T;
	validateArgs: (options: T, cli: import('minimist').ParsedArgs) => boolean;
}

export interface ParsedCLI<T extends BaseCLIOptions> {
	options: T;
	args: string[];
	hasConfigFile: boolean;
}
