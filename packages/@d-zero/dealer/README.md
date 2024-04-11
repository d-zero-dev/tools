# Dealer

Dealer is an API and CLI that processes a given collection in parallel and logs the output in sequence to the standard output.

## Install

```shell
npm install @d-zero/dealer
```

## API

```ts
import { deal } from '@d-zero/dealer';

await deal(items, {
	limit: 30,
	header: (progress, done, total, limit) =>
		progress === 1
			? 'HeaderMessage: Done!'
			: `HeaderMessage: %earth% %dots% %block% %propeller%`,
	setup: (item, update, index) => {
		item.setup();
		item.addListeners((state) => {
			update(`item(${index}): ${state}`);
		});

		return async () => {
			await item.start();
			item.cleanup();
		};
	},
});
```
