import type { Role } from './types.js';
import type { Backlog } from 'backlog-js';
import type { Project, User } from 'backlog-js/dist/types/entity.js';

import { NotionDB } from '@d-zero/notion';
import { skipHolydayPeriod } from '@d-zero/shared/skip-holyday-period';
import dayjs from 'dayjs';

import { PROJECT_COMMON_TASK_LIST_NOTION_URL } from './define.js';

type Params = {
	backlogProject: Project.Project;
	assignedUsers: Record<Role, User.User>;
	backlogCategory?: string;
	log?: (message: string) => void;
};

export async function assign(backlog: Backlog, params: Params) {
	if (!process.env.NOTION_TOKEN) {
		throw new Error('NOTION_TOKEN is not defined. Please set it in .env file');
	}

	const project = params.backlogProject;
	const assignedUsers = params.assignedUsers;
	const categoryName = params.backlogCategory?.trim() ?? null;

	const db = new NotionDB(process.env.NOTION_TOKEN, PROJECT_COMMON_TASK_LIST_NOTION_URL);
	const data = await db.getTable({
		sorts: [
			{
				property: '順番',
				direction: 'ascending',
			},
		],
	});

	if (!data['課題名']) {
		return;
	}

	const categories = await backlog.getCategories(project.id);
	const issueTypes = await backlog.getIssueTypes(project.id);
	const issueTypeTask = issueTypes.find((t) => t.name === 'タスク') ?? issueTypes[0];

	if (!issueTypeTask) {
		throw new Error('issueTypes is not found');
	}

	const category = categoryName
		? categories.find((c) => c.name === categoryName) ??
			(await backlog.postCategories(project.id, { name: categoryName }))
		: null;

	const now = dayjs();

	let i = 0;
	let currentDate = now.clone();
	let interval = 0;

	for (const value of data['課題名']) {
		const days = +(data['工数（人日）']?.[i] || 1) - 1;

		const { startDate, dueDate } = skipHolydayPeriod(
			currentDate,
			currentDate.add(days, 'day'),
		);

		const start = startDate.format('YYYY-MM-DD');
		const due = dueDate.format('YYYY-MM-DD');

		const role = data['担当']?.[i] as Role;

		if (!role) {
			throw new Error('role not found');
		}

		const assignedUser = assignedUsers[role];

		const result = await backlog.postIssue({
			projectId: project.id,
			summary: value as string,
			priorityId: 3,
			issueTypeId: issueTypeTask.id,
			startDate: start,
			dueDate: due,
			assigneeId: assignedUser.id,
			categoryId: category ? [category.id] : [],
		});

		const realDays = dueDate.diff(startDate, 'day');

		params.log?.(`${result.issueKey} ${result.summary} @${assignedUser.name}`);
		interval = +(data['前工程との間隔（人日）']?.[i] || 0) + 1;
		currentDate = currentDate.add(realDays + interval, 'day');
		i++;
	}

	// https://xxx.backlog.jp/gantt/API_TEST?span=6&scale=days&grouping=3&startDate=2024/01/01
	const resultUrl = `${backlog.webAppBaseURL}/gantt/${project.projectKey}?span=6&scale=days&grouping=3&startDate=${now.format('YYYY/MM/DD')}`;
	params.log?.(`🔗 ${resultUrl}`);
}
