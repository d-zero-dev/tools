import { test, expect } from 'vitest';

import { countDownFunctionParser } from './count-down-function-parser.js';

test('Succeed', () => {
	expect(countDownFunctionParser('ABC%countDown(10000,a)%')).toStrictEqual({
		id: 'a',
		time: 10_000,
		placeholder: '%countDown(10000,a)%',
		unit: 'ms',
	});
});

test('Succeed Unit:s', () => {
	expect(countDownFunctionParser('ABC%countDown(3000 , a , s)%')).toStrictEqual({
		id: 'a',
		time: 3000,
		placeholder: '%countDown(3000 , a , s)%',
		unit: 's',
	});
});

test('Failed', () => {
	expect(countDownFunctionParser('ABC%countDown(10000)%')).toBeNull();
});
