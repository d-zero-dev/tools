import debug from 'debug';

/** Root debug logger for the beholder package. */
export const scraperLog = debug('Beholder');
/** Debug logger for resource fetching. */
export const resourceLog = scraperLog.extend('Resource');
/** Debug logger for DOM evaluation. */
export const domLog = scraperLog.extend('DOM');
/** Debug logger for detailed DOM evaluation output. */
export const domDetailsLog = domLog.extend('Details');
