#!/usr/bin/env node
import type { Role } from './types.js';
import type { User } from 'backlog-js/dist/types/entity.js';

import dotenv from 'dotenv';
import Enquirer from 'enquirer';
import minimist from 'minimist';

import { assign } from './assign.js';
import { createBacklogClient } from './create-backlog-client.js';
import { roles } from './define.js';
import { getBacklogProjectIdFromUrl } from './get-backlog-project-id-from-url.js';

dotenv.config();

const cli = minimist(process.argv.slice(2), {
	alias: {
		a: 'assign',
	},
});

const backlog = createBacklogClient();

if (cli.assign) {
	const users = await backlog.getUsers();
	const dzUsers = users.filter((u) => u.mailAddress.endsWith('@d-zero.co.jp'));

	const { projectId } = await Enquirer.prompt<{ projectId: string }>({
		name: 'projectId',
		message: 'BacklogのプロジェクトURLを入力してください',
		type: 'input',
		required: true,
		result(value) {
			return getBacklogProjectIdFromUrl(value);
		},
	});

	const project = await backlog.getProject(projectId);

	const { category } = await Enquirer.prompt<{ category: string }>({
		name: 'category',
		message: 'カテゴリーを入力してください（ガントチャートなどで管理しやすくなります）',
		type: 'input',
		required: false,
	});

	const assignedUsers: Partial<Record<Role, User.User>> = {};

	for (const role of roles) {
		const { userName } = await Enquirer.prompt<{ userName: string }>({
			name: 'userName',
			message: `「${role}」を選択してください`,
			type: 'autocomplete',
			required: true,
			// @ts-ignore
			limit: 5,
			choices: dzUsers.map((u) => ({
				name: u.name,
				message: u.mailAddress,
				hint: u.name,
				value: u.name,
			})),
		});

		const user = dzUsers.find((u) => u.name === userName);

		if (!user) {
			throw new Error(`User ${userName} is not found`);
		}

		assignedUsers[role] = user;
	}

	await assign(backlog, {
		backlogProject: project,
		backlogCategory: category || undefined,
		assignedUsers: assignedUsers as Record<Role, User.User>,
		log(message) {
			process.stdout.write(message + '\n');
		},
	});
}
