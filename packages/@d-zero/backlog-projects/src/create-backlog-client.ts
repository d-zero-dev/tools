import { Backlog } from 'backlog-js';

let singleton: Backlog | null = null;

export function createBacklogClient(): Backlog {
	if (singleton) {
		return singleton;
	}

	if (!process.env.BACKLOG_HOST) {
		throw new Error('BACKLOG_HOST is not defined. Please set it in .env file');
	}

	if (!process.env.BACKLOG_APIKEY) {
		throw new Error('BACKLOG_APIKEY is not defined. Please set it in .env file');
	}

	singleton = new Backlog({
		host: process.env.BACKLOG_HOST,
		apiKey: process.env.BACKLOG_APIKEY,
	});

	return singleton;
}
