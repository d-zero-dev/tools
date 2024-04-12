# `@d-zero/puppeteer-scroll`

Puppeteerでスクロールするための関数を提供します。

`IntersectionObserver`や`loading="lazy"`などの機能を使っているサイトに対して表示や読み込みを完了させるために、スクロールを行います。

## インストール

```sh
yarn install @d-zero/puppeteer-scroll
```

## 使い方

```ts
import { scrollAllOver } from '@d-zero/puppeteer-scroll';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

await scrollAllOver(page);
```
