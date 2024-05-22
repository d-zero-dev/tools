// Run on child_process

import type { AnyAction } from 'typescript-fsa';

import { isType } from 'typescript-fsa';

import { scraperLog } from './debug.js';
import { scraperEvent, subProcessEvent } from './events.js';
import Scraper from './scraper.js';

const log = scraperLog.extend(`${process.pid}`);

process.title = 'beholder';
const scraper = new Scraper();

scraper.on('resourceResponse', (context) => {
	if (process.connected) {
		process.send!(scraperEvent.resourceResponse(context));
	}
});

scraper.on('ignoreAndSkip', (context) => {
	if (process.connected) {
		process.send!(scraperEvent.ignoreAndSkip(context));
	}
});

scraper.on('scrapeEnd', (context) => {
	if (process.connected) {
		process.send!(scraperEvent.scrapeEnd(context));
	}
});

scraper.on('error', (context) => {
	if (process.connected) {
		const _context = {
			...context,
			error: {
				name: context.error.name,
				message: context.error.message,
				stack: context.error.stack,
			},
		};
		process.send!(scraperEvent.error(_context));
	}
});

scraper.on('changePhase', (context) => {
	if (process.connected) {
		process.send!(scraperEvent.changePhase(context));
	}
});

process.on('message', async (action: AnyAction) => {
	if (isType(action, subProcessEvent.start)) {
		void scraper.scrapeStart(
			action.payload.url,
			{
				isExternal: action.payload.isExternal,
				isGettingImages: action.payload.isGettingImages,
				excludeKeywords: action.payload.excludeKeywords,
				executablePath: action.payload.executablePath,
				disableQueries: action.payload.disableQueries,
				isTitleOnly: action.payload.isTitleOnly,
				screenshot: action.payload.screenshot,
			},
			action.payload.isSkip,
		);
	}

	if (isType(action, subProcessEvent.destroy)) {
		await scraper.destroy(false);
	}
});

scraper.on('destroyed', (context) => {
	if (process.connected) {
		process.send!(scraperEvent.destroyed(context));
		log('disconnects process');
		process.disconnect();
	}
});

process.on('disconnect', () => {
	log('Process is disconnected');
});
