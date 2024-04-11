import c from 'ansi-colors';

import { Lanes } from '../dist/index.js';

const lanes = new Lanes({
	sort: ([a], [b]) => a - b,
});

lanes.header(`${c.red.bold('Header')} %earth% %dots%`);

// eslint-disable-next-line no-constant-condition
while (true) {
	await delay(300);
	const time = new Date().getSeconds();
	const id = time % 10;
	switch (id) {
		case 1: {
			lanes.update(
				id,
				`%dots% %propeller% ${Math.random() + id} %countDown(20000,${id},s)%s`,
			);
			break;
		}
		case 5: {
			lanes.update(
				id,
				`%dots% %propeller% ${Math.random() + id} %countDown(10000,${id})%ms`,
			);
			break;
		}
		default: {
			lanes.update(id, `%dots% %propeller% ${Math.random() + id}`);
		}
	}
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
