import type { Options, Result } from 'meow';

import meowHelp from 'cli-meow-help';
import meow from 'meow';

type AnyFlags = NonNullable<Parameters<typeof meow>[0]['flags']>;

interface CliSettings<CommandType extends string, Flags extends AnyFlags> {
	name: string;
	description?: string;
	header?: string;
	footer?: string;
	commands?: Record<CommandType, { desc: string }>;
	flags: Options<Flags>['flags'];
	onError?: (error: Error) => boolean;
}

interface RoarResult<CommandType extends string, Flags extends AnyFlags> {
	command?: CommandType;
	args: string[];
	flags: Result<Flags>['flags'];
}

/**
 *
 * @param settings
 */
export function roar<CommandType extends string, Flags extends AnyFlags>(
	settings: CliSettings<CommandType, Flags>,
): RoarResult<CommandType, Flags> {
	const help = meowHelp({
		name: settings.name,
		header: settings.header,
		desc: settings.description,
		footer: settings.footer,
		commands: settings.commands,
		flags: settings.flags,
	});

	const cli = meow(help, {
		importMeta: import.meta,
		flags: settings.flags,
	});

	if (Object.values(settings.commands ?? {}).length === 0) {
		return {
			args: cli.input,
			flags: cli.flags,
		};
	}

	const command = cli.input[0] as CommandType;
	const args = cli.input.slice(1);

	if (!command) {
		if (settings.onError) {
			const showHelp = settings.onError(new Error('No command specified'));
			if (showHelp) {
				cli.showHelp(1);
			}
		}
		process.exit(1);
	}

	return {
		command,
		args,
		flags: cli.flags,
	};
}
