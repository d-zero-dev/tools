import type { FileComparison } from './types.js';

import c from 'ansi-colors';

export interface OutputHandler {
	log(message: string): void;
	getTerminalWidth(): number;
}

export class ConsoleOutputHandler implements OutputHandler {
	getTerminalWidth(): number {
		return process.stdout.columns || 80;
	}
	log(message: string): void {
		// eslint-disable-next-line no-console
		console.log(message);
	}
}

/**
 *
 * @param comparison
 * @param outputHandler
 */
export function displayComparison(
	comparison: FileComparison,
	outputHandler: OutputHandler,
): void {
	if (comparison.isTextFile) {
		outputHandler.log(c.bold.green(comparison.relativePath));
	} else {
		outputHandler.log(c.bold.magenta(comparison.relativePath));
	}

	switch (comparison.status) {
		case 'missing': {
			outputHandler.log(
				`${c.red.bold('Local file is not found')}: ${comparison.relativePath}`,
			);
			if (comparison.remoteExists) {
				outputHandler.log(
					`${c.yellow.bold('Remote file exists')}: ${comparison.remotePath} (size: ${comparison.remoteSize})`,
				);
			} else {
				outputHandler.log(
					`${c.gray('Remote file also not found')}: ${comparison.remotePath}`,
				);
			}
			break;
		}
		case 'new': {
			outputHandler.log(`${c.green.bold('New file')}: ${comparison.relativePath}`);
			break;
		}
		case 'same': {
			outputHandler.log(
				`${c.bgGreen(' Same ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('=')} ${comparison.remoteSize}`,
			);
			break;
		}
		case 'modified': {
			if (comparison.isTextFile && comparison.diff) {
				const highLow =
					comparison.remoteSize === comparison.localSize
						? c.bold
						: comparison.remoteSize! - comparison.localSize! > 0
							? c.red
							: c.blue;
				outputHandler.log(
					`${c.bgRedBright(' Modified ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('->')} ${highLow(comparison.remoteSize!.toString())}`,
				);
				outputHandler.log(comparison.diff);
			} else {
				const highLow =
					comparison.remoteSize! - comparison.localSize! > 0 ? c.red : c.blue;
				outputHandler.log(
					`${c.bgRedBright(' Modified ')} ${c.black('Size:')} ${comparison.localSize} ${c.black('->')} ${highLow(comparison.remoteSize!.toString())}`,
				);
			}
			break;
		}
	}

	outputHandler.log('');
}
