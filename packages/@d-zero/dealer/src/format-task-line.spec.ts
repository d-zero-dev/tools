import { test, expect } from 'vitest';

import { formatTaskLine } from './format-task-line.js';

test('renders a pending step with no message as just the icon and name', () => {
	expect(formatTaskLine('pending', 'fetch', '')).toBe('[ ] fetch');
});

test('appends the message after a colon when present', () => {
	expect(formatTaskLine('running', 'fetch', 'downloading...')).toBe(
		'[%taskSpin%] fetch: downloading...',
	);
});

test('appends the elapsed time after the message when provided', () => {
	expect(formatTaskLine('running', 'fetch', 'downloading...', 3400)).toBe(
		'[%taskSpin%] fetch: downloading... (3.4s)',
	);
});

test('omits the elapsed time when not provided', () => {
	expect(formatTaskLine('done', 'fetch', 'done')).not.toContain('(');
});

test('renders the done icon with a checkmark character', () => {
	expect(formatTaskLine('done', 'fetch', '')).toContain('✔');
});

test('renders the error icon with a cross character', () => {
	expect(formatTaskLine('error', 'fetch', 'network down')).toContain('✘');
});
