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

## API

### `scrollAllOver(page, options?)`

ページを上から下までスクロールします。`body.scrollHeight`に到達するか、スクロールが進行しない状態（スクロールジャック等）が3イテレーション続いた時点で終了します。

#### オプション

| オプション | 型                                         | デフォルト                                  | 説明                                                                                                                            |
| ---------- | ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `interval` | `number \| DelayOptions`                   | `{ random: { min: 200, max: 500 } }`        | 各スクロール間のミリ秒。固定値またはランダム範囲（`{ random: ... }`）を指定可能。                                               |
| `distance` | `number \| DelayOptions`                   | 未指定時は`clientHeight × random(0.5, 1.0)` | 1ステップで進むピクセル数。固定値またはランダム範囲を指定可能。未指定時はビューポート高さの50〜100%の範囲でステップごとに変動。 |
| `logger`   | `(scrollY, scrollHeight, message) => void` | なし                                        | スクロール進捗のログ用コールバック。                                                                                            |

`DelayOptions`の型定義は[`@d-zero/shared/delay`](../shared/src/delay.md)を参照。

#### デフォルト挙動

オプションを渡さない場合、人間のスクロールに近い揺らぎを付けるため、`interval`と`distance`の両方がランダム化されます:

- **`interval`**: 200〜500ms の範囲で毎ループ均一分布からサンプリング
- **`distance`**: ビューポート高さの 50〜100% を毎ループブラウザ側`Math.random()`でサンプリング（`clientHeight`に比例するためモバイル・デスクトップを問わず安全）

決定論的な挙動が必要な場合（テスト、レコーディング、比較など）は、必ず`interval`と`distance`を明示的に指定してください:

```ts
// 完全固定（ランダム要素なし）。distance はピクセル値を直接指定する
await scrollAllOver(page, {
	interval: 300,
	distance: 800,
});
```

> **メモ**: `distance`に`0`以下の値を渡しても内部で最小`1`px に丸められます（スクロールジャック誤検出の防止）。`distance`はピクセル値であり、ビューポート比率では指定できません。

#### 使用例

```ts
import { scrollAllOver } from '@d-zero/puppeteer-scroll';

// すべてデフォルト（ランダム挙動）
await scrollAllOver(page);

// interval だけ固定
await scrollAllOver(page, { interval: 300 });

// interval と distance の両方をランダム化（distance はピクセル値）
await scrollAllOver(page, {
	interval: { random: { min: 200, max: 800 } },
	distance: { random: { min: 300, max: 900 } },
});

// 進捗ログ
await scrollAllOver(page, {
	logger: (scrollY, scrollHeight, message) => {
		console.log(`${message}: ${scrollY}/${scrollHeight}`);
	},
});
```

### スクロールジャック検出

`scrollBy`が呼ばれても`scrollY`が変化しない状態（fullpage.jsなどスクロールジャック系のライブラリが原因）を検出した場合、3イテレーション連続で進行がない時点で自動的に終了します。終了時には`logger`に`'Scroll stuck, bailing out'`が通知されます。

## 関連パッケージ

- [`@d-zero/puppeteer-page-scan`](../puppeteer-page-scan/README.md) — `scrollAllOver`を内包し、`scrollInterval` / `scrollDistance`オプション経由で挙動をカスタマイズ可能
- [`@d-zero/shared/delay`](../shared/src/delay.md) — `DelayOptions`型と確率分布のサポート
