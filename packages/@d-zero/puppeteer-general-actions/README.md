# `@d-zero/puppeteer-general-actions`

Puppeteer 処理のライフサイクル（フェーズ）ごとにマゼンタ背景のカラーラベル付きログを出力する汎用リスナー。

## Installation

```sh
yarn add @d-zero/puppeteer-general-actions
```

## Usage

```ts
import { createListener } from '@d-zero/puppeteer-general-actions';

type Phases = {
	start: { name: string; url: string };
	complete: { name: string; duration: number };
};

const listen = createListener<Phases>((log) => ({
	start: (data) => log(`開始: ${data.url}`),
	complete: (data) => log(`完了 (${data.duration}ms)`),
}))(console.log);

listen('start', { name: 'desktop', url: 'https://example.com' });
```

各フェーズハンドラはオプショナル。`name` フィールドがラベルとして表示される。
