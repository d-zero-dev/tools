/**
 * Extracts the project ID from a Backlog URL.
 *
 * Ex:
 *  - https://xxx.backlog.jp/projects/API_TEST
 *  - https://xxx.backlog.jp/add/API_TEST
 *  - https://xxx.backlog.jp/find/API_TEST?projectId=123
 *  - https://xxx.backlog.jp/board/API_TEST
 *  - https://xxx.backlog.jp/gantt/API_TEST
 *  - https://xxx.backlog.jp/wiki/API_TEST/Home
 *  - https://xxx.backlog.jp/file/API_TEST
 *  - https://xxx.backlog.jp/git/API_TEST
 *  - https://xxx.backlog.jp/EditProject.action?project.id=123
 *
 * @param url
 * @returns
 */
export function getBacklogProjectIdFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const paths = pathname.split('/').filter((p) => p !== '');
		const projectId = paths[1];
		if (!projectId) {
			const searchParams = urlObj.searchParams;
			const projectId = searchParams.get('project.id');
			if (!projectId) {
				throw new Error(`Project ID not found in URL: ${url}`);
			}
			return projectId;
		}
		return projectId;
	} catch (error) {
		if (error instanceof TypeError) {
			return url;
		}
		throw error;
	}
}
