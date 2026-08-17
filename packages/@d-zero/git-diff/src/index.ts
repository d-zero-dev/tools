import { execSync } from 'node:child_process';

const tag =
	process.argv[2] || execSync('git describe --tags --abbrev=0').toString('utf8').trim();
const tag2 = process.argv[3] || 'HEAD';
// cspell:disable-next-line
const gitDiff = `git diff --name-only ${tag} ${tag2} --diff-filter=ACMR`;
const list = execSync(gitDiff).toString('utf8').trim();
// eslint-disable-next-line no-console
console.log(list);
