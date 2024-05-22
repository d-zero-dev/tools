import debug from 'debug';

export const log = debug('Beholder');
export const scraperLog = log.extend('Scraper');
export const resourceLog = scraperLog.extend('Resource');
export const domLog = scraperLog.extend('DOM');
export const domDetailsLog = domLog.extend('Details');
