import { test, expect } from 'vitest';

import { ICON, TASK_LIST_ANIMATIONS } from './task-icons.js';

test('pending and running icons keep the brackets uncolored', () => {
	expect(ICON.pending).toBe('[ ]');
	expect(ICON.running).toBe('[%taskSpin%]');
});

test('done and error icons wrap a colored checkmark/cross inside plain brackets', () => {
	expect(ICON.done.startsWith('[')).toBe(true);
	expect(ICON.done.endsWith(']')).toBe(true);
	expect(ICON.done).toContain('✔');

	expect(ICON.error.startsWith('[')).toBe(true);
	expect(ICON.error.endsWith(']')).toBe(true);
	expect(ICON.error).toContain('✘');
});

test('taskSpin animation matches the %taskSpin% placeholder used by ICON.running', () => {
	expect(ICON.running).toBe('[%taskSpin%]');
	expect(TASK_LIST_ANIMATIONS.taskSpin).toBeDefined();
});

test('taskSpin is a 10-frame braille spinner at 12fps', () => {
	const [fps, ...sprites] = TASK_LIST_ANIMATIONS.taskSpin!;

	expect(fps).toBe(12);
	expect(sprites).toStrictEqual(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);
});
