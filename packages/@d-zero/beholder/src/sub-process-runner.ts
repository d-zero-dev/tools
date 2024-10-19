import type { ScraperOptions } from './scraper.js';
import type { SubProcessRunnerEventTypes, ExURL } from './types.js';
import type { AnyAction } from 'typescript-fsa';

import childProcess from 'node:child_process';
import path from 'node:path';

import { delay } from '@d-zero/shared/delay';
import { TypedAwaitEventEmitter } from '@d-zero/shared/typed-await-event-emitter';
import { isType } from 'typescript-fsa';

import { scraperLog } from './debug.js';
import { scraperEvent, subProcessEvent } from './events.js';

const __filename = new globalThis.URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const SUB_PROCESS_PATH = path.resolve(__dirname, 'sub-process');

export default class SubProcessRunner extends TypedAwaitEventEmitter<SubProcessRunnerEventTypes> {
	readonly #resetTime: number;
	#scrapedTimes = 0;
	#state: 'waiting' | 'running' = 'waiting';
	#subProcess: childProcess.ChildProcess | null = null;
	#undeadPid = new Set<number>();

	get state() {
		return this.#state;
	}

	constructor(resetTime: number) {
		super();
		this.#resetTime = resetTime;
	}

	destory() {
		const pid = this.#subProcess?.pid;
		if (this.#subProcess) {
			scraperLog('Destroys child_process (%d)', pid);
			this.#subProcess.send(subProcessEvent.destroy());

			if (pid) {
				void this.emit('reset', {
					pid,
				});
				void this.emit('changePhase', {
					pid,
					name: 'reset',
					url: null,
					isExternal: false,
					message: 'Reseting sub-process',
				});
			}

			this.#destroyed();
			return;
		}
		this.#destroyed();
	}

	getUndeadPid() {
		return [...this.#undeadPid];
	}

	kill() {
		if (!this.#subProcess) {
			return;
		}
		if (!this.#subProcess.killed) {
			scraperLog('Kills(SIGKILL) child_process (%d) ', this.#subProcess.pid);
			this.#subProcess.kill('SIGKILL');
			return;
		}
		scraperLog('child_process(%d) is already killed', this.#subProcess.pid);
	}

	start(url: ExURL, options: ScraperOptions, isSkip: boolean, interval: number) {
		if (this.#state === 'running') {
			throw new Error(`Sub Routine (PID: ${this.#subProcess?.pid}) is already running`);
		}
		void this.#scrape(url, options, isSkip, interval);
	}

	#createSubProcess(url: ExURL) {
		const subProcess = childProcess.fork(SUB_PROCESS_PATH, {
			detached: false,
		});

		subProcess.on('message', (action: AnyAction) => {
			if (isType(action, scraperEvent.changePhase)) {
				void this.emit('changePhase', action.payload);
			}

			if (isType(action, scraperEvent.ignoreAndSkip)) {
				this.#finished();
			}

			if (isType(action, scraperEvent.scrapeEnd)) {
				this.#finished();
			}

			if (isType(action, scraperEvent.destroyed)) {
				this.#destroyed();
			}

			if (
				isType(action, scraperEvent.ignoreAndSkip) ||
				isType(action, scraperEvent.resourceResponse) ||
				isType(action, scraperEvent.scrapeEnd) ||
				isType(action, scraperEvent.destroyed)
			) {
				void this.emit('scrapeEvent', action);
			}

			if (isType(action, scraperEvent.error)) {
				const error = new Error(action.payload.error.message);
				error.name = action.payload.error.name;
				error.stack = action.payload.error.stack;
				const _action = {
					type: action.type,
					payload: {
						pid: action.payload.pid,
						url: action.payload.url,
						shutdown: action.payload.shutdown,
						error,
					},
				};
				void this.emit('scrapeEvent', _action);
			}
		});

		subProcess.on('disconnect', () => {
			if (subProcess.killed) {
				scraperLog('child_process(%d) is disconnected and killed', subProcess.pid);
				return;
			}

			scraperLog('child_process(%d) is disconnected but not killed', subProcess.pid);
			scraperLog('Retries to kill(SIGTERM) child_process(%d)', subProcess.pid);
			subProcess.kill('SIGTERM');

			void this.emit('changePhase', {
				pid: subProcess.pid,
				name: 'disconnect',
				url: null,
				isExternal: false,
				message: 'Disconnecting sub-process',
			});
		});

		subProcess.on('error', (e) => {
			void this.emit('error', {
				pid: subProcess.pid,
				url,
				shutdown: true,
				error: e instanceof Error ? e : new Error(`${e}`),
			});
		});

		return subProcess;
	}

	#destroyed() {
		if (this.#subProcess && !this.#subProcess.killed && this.#subProcess.pid) {
			scraperLog('Add child_process(%d) to the undead PID list', this.#subProcess.pid);
			this.#undeadPid.add(this.#subProcess.pid);
		}
		this.#subProcess = null;
		this.#scrapedTimes = 0;
		this.#finally();
	}

	#finally() {
		this.#state = 'waiting';
	}

	#finished() {
		this.#scrapedTimes += 1;

		if (this.#scrapedTimes >= this.#resetTime) {
			this.destory();
		} else {
			this.#finally();
		}
	}

	async #scrape(url: ExURL, options: ScraperOptions, isSkip: boolean, interval: number) {
		if (!this.#subProcess) {
			this.#subProcess = this.#createSubProcess(url);

			void this.emit('changePhase', {
				pid: this.#subProcess.pid,
				name: 'boot',
				url,
				isExternal: options.isExternal,
				message: 'Booting sub-process',
			});
		}

		this.#state = 'running';

		interval = Math.max(interval, 0);
		if (interval) {
			await delay(interval);
		}

		this.#subProcess.send(
			subProcessEvent.start({
				url,
				isExternal: options.isExternal,
				isGettingImages: options.isGettingImages,
				excludeKeywords: options.excludeKeywords,
				executablePath: options.executablePath,
				disableQueries: options.disableQueries ?? false,
				isSkip,
				isTitleOnly: options.isTitleOnly,
				screenshot: options.screenshot,
			}),
		);
	}
}
