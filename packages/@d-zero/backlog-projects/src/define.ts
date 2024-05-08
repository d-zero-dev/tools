import type { Role } from './types.js';

export const PROJECT_COMMON_TASK_LIST_NOTION_URL =
	'https://www.notion.so/f4cdc643ebcb4221812bce6883e9422c?v=e09c94c1ab14487bb79833c076ba0998';

export const roles: ReadonlySet<Role> = new Set([
	'窓口',
	'ディレクション',
	'情報設計',
	'ビジュアルデザイン',
	'フロントエンド',
	'システム',
]);
