import type { BaseCLIOptions, CLIConfig, ParsedCLI } from './types.js';

import { parseInterval } from '@d-zero/shared/parse-interval';
import minimist from 'minimist';

/**
 *
 * @param config
 */
export function createCLI<T extends BaseCLIOptions>(config: CLIConfig<T>): ParsedCLI<T> {
	const cli = minimist(process.argv.slice(2), {
		alias: config.aliases,
	});

	const options = config.parseArgs(cli);
	const hasConfigFile = !!options.listfile;

	if (!config.validateArgs(options, cli)) {
		process.stderr.write(config.usage.join('\n') + '\n');
		process.exit(1);
	}

	return {
		options,
		args: cli._,
		hasConfigFile,
	};
}

/**
 *
 * @param cli
 */
export function parseCommonOptions(
	cli: minimist.ParsedArgs,
): Pick<BaseCLIOptions, 'limit' | 'debug' | 'verbose' | 'interval'> {
	return {
		limit: cli.limit ? Number.parseInt(cli.limit) : undefined,
		debug: !!cli.debug,
		verbose: !!cli.verbose,
		interval: cli.interval
			? parseInterval(
					typeof cli.interval === 'string' ? cli.interval : String(cli.interval),
				)
			: undefined,
	};
}
