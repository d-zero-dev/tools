import { parseGoogleUrl } from './parse-google-url.js';

/**
 * Get Google Sheet ID from Google Sheet URL
 * @param sheetUrl - Google Sheet URL
 * @returns Google Sheet ID. `null` if the URL is not a spreadsheet URL
 * @example
 * ```ts
 * getIdFromSheetUrl('https://docs.google.com/spreadsheets/d/1OzlmZDxtnzHMYAoebiiFWa9SYJkvSC1SJ1jatfFLSeI/edit#gid=0');
 * //=> '1OzlmZDxtnzHMYAoebiiFWa9SYJkvSC1SJ1jatfFLSeI'
 * ```
 */
export function getIdFromSheetUrl(sheetUrl: string) {
	const target = parseGoogleUrl(sheetUrl);
	return target?.kind === 'spreadsheet' ? target.id : null;
}
