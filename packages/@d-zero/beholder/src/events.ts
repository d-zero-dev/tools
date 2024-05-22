import type { ScrapeEventTypes, SubProcessEventTypes } from './types.js';

import { actionCreatorFactory } from 'typescript-fsa';

const scraperEventCreator = actionCreatorFactory('@@scraper');
const subProcessEventCreator = actionCreatorFactory('@@sub-process');

export const subProcessEvent = {
	start: subProcessEventCreator<SubProcessEventTypes['start']>('start'),
	destroy: subProcessEventCreator<SubProcessEventTypes['destroy']>('destroy'),
};

export const scraperEvent = {
	ignoreAndSkip: scraperEventCreator<ScrapeEventTypes['ignoreAndSkip']>('ignoreAndSkip'),
	resourceResponse:
		scraperEventCreator<ScrapeEventTypes['resourceResponse']>('resourceResponse'),
	scrapeEnd: scraperEventCreator<ScrapeEventTypes['scrapeEnd']>('scrapeEnd'),
	destroyed: scraperEventCreator<ScrapeEventTypes['destroyed']>('destroyed'),
	error: scraperEventCreator<ScrapeEventTypes['error']>('error'),
	changePhase: scraperEventCreator<ScrapeEventTypes['changePhase']>('changePhase'),
};
