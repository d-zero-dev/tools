/**
 * Get Google Sheet ID from Google Sheet URL
 *
 * @param sheetUrl - Google Sheet URL
 * @returns Google Sheet ID
 *
 * @example
 * ```ts
 * getIdFromSheetUrl('https://docs.google.com/spreadsheets/d/1OzlmZDxtnzHMYAoebiiFWa9SYJkvSC1SJ1jatfFLSeI/edit#gid=0');
 * //=> '1OzlmZDxtnzHMYAoebiiFWa9SYJkvSC1SJ1jatfFLSeI'
 * ```
 */
export function getIdFromSheetUrl(sheetUrl: string) {
	const url = new URL(sheetUrl);
	const id = url.pathname.split('/')[3];
	return id ?? null;
}
