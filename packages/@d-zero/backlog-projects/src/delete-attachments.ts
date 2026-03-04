import type { Backlog } from 'backlog-js';
import type { Issue } from 'backlog-js/dist/types/entity.js';

import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { deal } from '@d-zero/dealer';
import { delay } from '@d-zero/shared/delay';
import { kbSize } from '@d-zero/shared/filesize';
import { retryCall } from '@d-zero/shared/retry';
import c from 'ansi-colors';
import dayjs from 'dayjs';

interface DeleteAttachmentsParams {
	/**
	 * この日付以前（この日を含む）に最終更新された課題が対象。
	 * Backlog API の updatedUntil パラメータに渡される。
	 * 例: '2024-01-01' → 2024年1月1日以前に更新された課題
	 */
	updatedUntil: string;
	outDir: string;
	verbose?: boolean;
}

type Task =
	| { readonly kind: 'collector' }
	| {
			readonly kind: 'attachment';
			readonly issueKey: string;
			readonly projectKey: string;
			readonly attachment: Issue.Issue['attachments'][number];
	  };

const BATCH_SIZE = 20;
const ISSUES_PER_REQUEST = 100;
const API_DELAY_MS = 1000;
const RETRY_OPTIONS = {
	retries: 5,
	interval: { random: { min: 5000, max: 15_000 } },
};

/**
 *
 * @param backlog
 * @param params
 */
export async function deleteAttachments(
	backlog: Backlog,
	params: DeleteAttachmentsParams,
) {
	const { updatedUntil, outDir, verbose } = params;
	const projectKeyCache = new Map<number, string>();
	let processedCount = 0;
	let totalAttachments = 0;
	let totalSize = 0;
	let issueCount = 0;
	let collectionDone = false;

	const resolveProjectKey = async (projectId: number) => {
		const cached = projectKeyCache.get(projectId);
		if (cached) {
			return cached;
		}
		await delay(API_DELAY_MS);
		const project = await retryCall(() => backlog.getProject(projectId), RETRY_OPTIONS);
		projectKeyCache.set(projectId, project.projectKey);
		return project.projectKey;
	};

	await deal<Task>(
		[{ kind: 'collector' }],
		(task, update, _index, setLineHeader, push) => {
			if (task.kind === 'collector') {
				return async () => {
					update('%braille% プロジェクト一覧を取得中%dots%');

					const [archivedProjects, activeProjects] = await Promise.all([
						retryCall(() => backlog.getProjects({ archived: true }), RETRY_OPTIONS),
						retryCall(() => backlog.getProjects({ archived: false }), RETRY_OPTIONS),
					]);
					const allProjects = [...archivedProjects, ...activeProjects];
					const totalBatches = Math.ceil(allProjects.length / BATCH_SIZE);

					for (const p of allProjects) {
						projectKeyCache.set(p.id, p.projectKey);
					}

					for (let i = 0; i < allProjects.length; i += BATCH_SIZE) {
						const batch = allProjects.slice(i, i + BATCH_SIZE);
						const projectIds = batch.map((p) => p.id);
						const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

						update(
							`%braille% ${c.gray(batch.map((p) => p.projectKey).join(', '))}: バッチ ${batchIndex}/${totalBatches} 課題を検索中%dots%`,
						);

						let hasMore = true;
						let offset = 0;

						while (hasMore) {
							await delay(API_DELAY_MS);

							const issues = await retryCall(
								() =>
									backlog.getIssues({
										projectId: projectIds,
										attachment: true,
										count: ISSUES_PER_REQUEST,
										offset,
										updatedUntil,
									}),
								RETRY_OPTIONS,
							);

							if (issues.length === 0) {
								break;
							}

							for (const issue of issues) {
								if (issue.attachments.length === 0) {
									continue;
								}

								issueCount++;
								const projectKey = await resolveProjectKey(issue.projectId);

								for (const attachment of issue.attachments) {
									totalAttachments++;
									await push({
										kind: 'attachment',
										issueKey: issue.issueKey,
										projectKey,
										attachment,
									});
								}
							}

							offset += issues.length;

							if (issues.length < ISSUES_PER_REQUEST) {
								hasMore = false;
							}
						}
					}

					collectionDone = true;
					update(
						`${c.green('✓')} 収集完了 | 課題: ${issueCount} | ファイル: ${totalAttachments}`,
					);
				};
			}

			return async () => {
				setLineHeader(`${c.bgWhite(c.black(` ${task.issueKey} `))} `);
				update(`${task.attachment.name}: ダウンロード中%dots%`);

				const issueDir = path.join(outDir, task.projectKey, task.issueKey);
				await mkdir(issueDir, { recursive: true });

				const filePath = path.join(
					issueDir,
					`${dayjs(task.attachment.created).format('YYYYMMDD')}_${task.attachment.id}_${task.attachment.name}`,
				);

				const fileData = await retryCall(
					() => backlog.getIssueAttachment(task.issueKey, task.attachment.id),
					RETRY_OPTIONS,
				);
				await pipeline(fileData.body, createWriteStream(filePath));
				totalSize += task.attachment.size;

				update(`${task.attachment.name} (${kbSize(task.attachment.size)}): 削除中%dots%`);

				await delay(API_DELAY_MS);

				const deleteResult = await retryCall(
					() => backlog.deleteIssueAttachment(task.issueKey, String(task.attachment.id)),
					RETRY_OPTIONS,
				);

				const metaPath = `${filePath}.json`;
				await writeFile(metaPath, JSON.stringify(deleteResult, null, 2));

				processedCount++;
				update(
					`${c.green('✓')} ${task.attachment.name} (${kbSize(task.attachment.size)})`,
				);
			};
		},
		{
			limit: 6,
			verbose,
			interval: API_DELAY_MS,
			header: () => {
				if (
					collectionDone &&
					processedCount === totalAttachments &&
					totalAttachments > 0
				) {
					return c.bold.green(
						`✓ 完了 | 課題: ${issueCount} | ファイル: ${processedCount}/${totalAttachments} | ${kbSize(totalSize)}`,
					);
				}
				const pct =
					totalAttachments > 0
						? Math.round((processedCount / totalAttachments) * 100)
						: 0;
				if (collectionDone) {
					return `${c.bold.cyan('処理中')} %earth% ${processedCount}/${totalAttachments} (${pct}%) | 課題: ${issueCount} | ${kbSize(totalSize)}`;
				}
				return `${c.bold.cyan('収集＆処理中')} %earth% ${processedCount}/${totalAttachments} (${pct}%) | 課題: ${issueCount} | ${kbSize(totalSize)}`;
			},
		},
	);

	if (totalAttachments === 0) {
		process.stderr.write(c.bold.yellow('対象の添付ファイルはありません') + '\n');
	}
}
