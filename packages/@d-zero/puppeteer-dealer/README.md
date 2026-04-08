# `@d-zero/puppeteer-dealer`

Puppeteerを使ってマルチプロセスで複数のURLを処理するためのパッケージです。

## API

### `deal`

URLリストを処理するメイン関数です。

```ts
import { deal, createProcess } from '@d-zero/puppeteer-dealer';

await deal(
	// URLリスト
	[
		{
			id: '1',
			url: 'https://example.com',
		},
		{
			id: '2',
			url: 'https://example.com',
		},
	],

	// ヘッダーログ
	(progress, done, total) => {
		return `Header ${Math.ceil(progress * 100)}% ${done}/${total}`;
	},

	// プロセス作成関数
	() => {
		return createProcess(
			'./child-process.js', // 子プロセスのパス
			{
				// 子プロセスに渡すパラメータ
				// 任意のデータを渡すことができます
			},
			{
				// オプション
				locale: 'ja-JP',
				headless: true,
			},
		);
	},

	// オプション
	{
		limit: 10,
		debug: false,
		verbose: false,
	},
);
```

**型定義:**

```ts
function deal<T, R = void>(
	list: readonly URLInfo[],
	header: DealHeader,
	createProcess: () => (needAuth: boolean) => ChildProcessManager<T, R>,
	options?: Omit<DealOptions, 'header'> & {
		each?: (
			result: R,
			push: (...items: URLInfo[]) => Promise<void>,
		) => void | Promise<void>;
	},
): Promise<void>;

type URLInfo = {
	readonly id: string | null;
	readonly url: string | URL;
};

type DealHeader = (
	progress: number,
	done: number,
	total: number,
	limit: number,
) => string;
```

### `createProcess`

子プロセスを作成する関数です。`deal`関数の第3引数で使用します。

```ts
import { createProcess } from '@d-zero/puppeteer-dealer';

const processFactory = createProcess(
	'./child-process.js', // 子プロセスのパス
	{
		// 子プロセスに渡すパラメータ
		param1: 'value1',
		param2: 'value2',
	},
	{
		// Puppeteerオプション
		locale: 'ja-JP',
		headless: true,
		// その他のLaunchOptions
	},
);
```

**型定義:**

```ts
function createProcess<P, R = void>(
	subModulePath: string,
	params: P,
	options?: PuppeteerDealerOptions & LaunchOptions,
): (needAuth: boolean) => ChildProcessManager<P, R>;

type PuppeteerDealerOptions = {
	readonly locale?: string;
} & DealOptions;
```

### `createChildProcess`

子プロセス側で使用する関数です。Puppeteerページの処理を定義します。

```ts
// child-process.ts
import { createChildProcess } from '@d-zero/puppeteer-dealer';

type ChildProcessParams = {
	param1: string;
	param2: string;
};

createChildProcess<ChildProcessParams>((params) => {
	const { param1, param2, needAuth } = params;

	return {
		async eachPage({ page, id, url, index }, logger) {
			// Puppeteerページの処理
			logger('ページにアクセスしています...');
			await page.goto(url);

			logger('処理を実行しています...');
			await page.evaluate(() => {
				// ページ内での処理
			});

			// 戻り値を返すことができます
			return { success: true };
		},
	};
});
```

**型定義:**

```ts
function createChildProcess<P, R = void>(
	handler: ChildProcessHandler<P & CommonParams, R>,
): void;

type ChildProcessHandler<P extends CommonParams, R> = (
	params: P,
) => Promise<ChildProcessMethods<R>> | ChildProcessMethods<R>;

type ChildProcessMethods<R> = {
	eachPage: (params: EachPageParams, logger: Logger) => Promise<R>;
};

type EachPageParams = {
	readonly page: Page;
	readonly id: string;
	readonly url: string;
	readonly index: number;
};

type CommonParams = {
	readonly needAuth: boolean;
};

type Logger = (log: string) => void;
```

## 使用例

完全な使用例:

**main-process.ts:**

```ts
import path from 'node:path';
import { deal, createProcess } from '@d-zero/puppeteer-dealer';

type ChildProcessParams = {
	outputDir: string;
};

await deal(
	[
		{ id: '1', url: 'https://example.com/page1' },
		{ id: '2', url: 'https://example.com/page2' },
	],
	(_, done, total) => {
		return `処理中: ${done}/${total}`;
	},
	() => {
		return createProcess<ChildProcessParams>(
			path.resolve(import.meta.dirname, 'child-process.js'),
			{
				outputDir: './output',
			},
			{
				locale: 'ja-JP',
				headless: true,
			},
		);
	},
	{
		limit: 5,
		debug: false,
	},
);
```

**child-process.ts:**

```ts
import { createChildProcess } from '@d-zero/puppeteer-dealer';

type ChildProcessParams = {
	outputDir: string;
};

createChildProcess<ChildProcessParams>(async (params) => {
	const { outputDir, needAuth } = params;

	return {
		async eachPage({ page, id, url }, logger) {
			logger(`${url}を処理しています...`);

			await page.goto(url);

			const title = await page.title();
			logger(`タイトル: ${title}`);

			// スクリーンショットを撮る
			await page.screenshot({
				path: `${outputDir}/${id}.png`,
			});

			logger('完了');
		},
	};
});
```
