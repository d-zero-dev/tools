import { test, expect } from 'vitest';

import { TaskListStepError } from './task-list-step-error.js';

test('keeps the original Error as cause and reports name/index in the message', () => {
	const original = new Error('network down');
	const error = new TaskListStepError('fetch', 1, original);

	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('TaskListStepError');
	expect(error.stepName).toBe('fetch');
	expect(error.stepIndex).toBe(1);
	expect(error.cause).toBe(original);
	expect(error.message).toBe('Step "fetch" (index: 1) failed: network down');
});

test('describes a non-Error thrown value with String()', () => {
	const error = new TaskListStepError('save', 2, 'boom');

	expect(error.cause).toBe('boom');
	expect(error.message).toBe('Step "save" (index: 2) failed: boom');
});
