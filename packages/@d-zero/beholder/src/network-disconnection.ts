/**
 * Chromium network error codes that indicate a transient network disconnection.
 * When sub-resource requests fail with these errors, the page should be retried.
 *
 * These codes are defined in Chromium's net_error_list.h:
 * https://source.chromium.org/chromium/chromium/src/+/main:net/base/net_error_list.h
 *
 * Selection criteria: errors caused by transient connectivity loss (NIC flip,
 * Wi-Fi roaming, brief ISP outage). Permanent DNS or TLS errors
 * (e.g. ERR_NAME_NOT_RESOLVED, ERR_CERT_*) are excluded because retrying
 * the same page would not recover from them.
 *
 * To update: search net_error_list.h for new transient-connectivity codes
 * when upgrading the Puppeteer / Chromium version.
 */
export const NETWORK_DISCONNECTION_ERRORS: ReadonlySet<string> = new Set([
	'net::ERR_NETWORK_CHANGED',
	'net::ERR_INTERNET_DISCONNECTED',
	'net::ERR_CONNECTION_RESET',
	'net::ERR_NETWORK_IO_SUSPENDED',
	'net::ERR_CONNECTION_TIMED_OUT',
]);

/**
 * Checks whether any of the given failed requests were caused by a network disconnection.
 * @param failedRequests - Array of failed request entries
 * @returns The subset of failed requests caused by network disconnection, empty array if none
 */
export function findDisconnectionFailures(
	failedRequests: ReadonlyArray<{ url: string; errorText: string }>,
): Array<{ url: string; errorText: string }> {
	return failedRequests.filter((r) => NETWORK_DISCONNECTION_ERRORS.has(r.errorText));
}
