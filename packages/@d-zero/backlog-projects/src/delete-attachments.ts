import type { Backlog } from 'backlog-js';
import type { Issue, Project } from 'backlog-js/dist/types/entity.js';

import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { deal } from '@d-zero/dealer';
import { delay } from '@d-zero/shared/delay';
import { kbSize } from '@d-zero/shared/filesize';
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
	log?: (message: string) => void;
}

interface AttachmentTask {
	issueKey: string;
	projectKey: string;
	attachment: Issue.Issue['attachments'][number];
	outDir: string;
}

const BATCH_SIZE = 20;
const ISSUES_PER_REQUEST = 100;
const API_DELAY_MS = 1000;

/**
 *
 * @param backlog
 * @param params
 */
export async function deleteAttachments(
	backlog: Backlog,
	params: DeleteAttachmentsParams,
) {
	const { updatedUntil, outDir, verbose, log } = params;

	log?.('プロジェクト一覧を取得中...');

	const [archivedProjects, activeProjects] = await Promise.all([
		backlog.getProjects({ archived: true }),
		backlog.getProjects({ archived: false }),
	]);
	const allProjects = [...archivedProjects, ...activeProjects];
	const totalBatches = Math.ceil(allProjects.length / BATCH_SIZE);

	log?.(`対象プロジェクト数: ${allProjects.length} (${totalBatches} バッチ)`);

	const tasks = await collectAttachmentTasks(
		backlog,
		allProjects,
		updatedUntil,
		outDir,
		log,
	);

	if (tasks.length === 0) {
		log?.('対象の添付ファイルはありません');
		return;
	}

	log?.(`\n添付ファイル ${tasks.length} 件の処理を開始します\n`);

	let downloaded = 0;
	let deleted = 0;
	let totalSize = 0;

	await deal(
		tasks,
		(task, update, _index, setLineHeader) => {
			const lineHeader = `%braille% ${c.bgWhite(c.black(` ${task.issueKey} `))} ${c.gray(task.attachment.name)}: `;
			setLineHeader(lineHeader);

			return async () => {
				update('ダウンロード中%dots%');

				const issueDir = path.join(task.outDir, task.projectKey, task.issueKey);
				await mkdir(issueDir, { recursive: true });

				const filePath = path.join(
					issueDir,
					`${dayjs(task.attachment.created).format('YYYYMMDD')}_${task.attachment.id}_${task.attachment.name}`,
				);

				const fileData = await backlog.getIssueAttachment(
					task.issueKey,
					task.attachment.id,
				);

				await pipeline(fileData.body, createWriteStream(filePath));
				downloaded++;
				totalSize += task.attachment.size;

				update(`DL ${c.green('✓')} (${kbSize(task.attachment.size)}) → 削除中%dots%`);

				const deleteResult = await backlog.deleteIssueAttachment(
					task.issueKey,
					String(task.attachment.id),
				);

				const metaPath = `${filePath}.json`;
				await writeFile(metaPath, JSON.stringify(deleteResult, null, 2));
				deleted++;

				update(c.green(`✓ ${kbSize(task.attachment.size)}`));
			};
		},
		{
			limit: 1,
			verbose,
			interval: API_DELAY_MS,
			header: (progress, done, total) => {
				const pct = Math.round(progress * 100);
				if (progress === 1) {
					return c.bold.green(
						`✓ 完了: ${done}/${total} (${pct}%) — DL: ${downloaded} / DEL: ${deleted} / ${kbSize(totalSize)}`,
					);
				}
				return `${c.bold.cyan('処理中')} %earth% ${done}/${total} (${pct}%) — DL: ${c.green(String(downloaded))} / DEL: ${c.green(String(deleted))} / ${kbSize(totalSize)}`;
			},
		},
	);
}

/**
 *
 * @param backlog
 * @param projects
 * @param updatedUntil
 * @param outDir
 * @param log
 */
async function collectAttachmentTasks(
	backlog: Backlog,
	projects: Project.Project[],
	updatedUntil: string,
	outDir: string,
	log?: (message: string) => void,
): Promise<AttachmentTask[]> {
	const tasks: AttachmentTask[] = [];
	const totalBatches = Math.ceil(projects.length / BATCH_SIZE);

	for (let i = 0; i < projects.length; i += BATCH_SIZE) {
		const batch = projects.slice(i, i + BATCH_SIZE);
		const projectIds = batch.map((p) => p.id);
		const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

		log?.(
			`[${batchIndex}/${totalBatches}] ${batch.map((p) => p.projectKey).join(', ')} — 課題を検索中...`,
		);

		let hasMore = true;

		while (hasMore) {
			await delay(API_DELAY_MS);

			const issues = await backlog.getIssues({
				projectId: projectIds,
				attachment: true,
				count: ISSUES_PER_REQUEST,
				updatedUntil,
			});

			if (issues.length === 0) {
				hasMore = false;
				break;
			}

			for (const issue of issues) {
				if (issue.attachments.length === 0) {
					continue;
				}

				const project = await backlog.getProject(issue.projectId);

				for (const attachment of issue.attachments) {
					tasks.push({
						issueKey: issue.issueKey,
						projectKey: project.projectKey,
						attachment,
						outDir,
					});
				}
			}

			log?.(`  課題 ${issues.length} 件 → 累計添付ファイル ${tasks.length} 件`);
		}
	}

	return tasks;
}
