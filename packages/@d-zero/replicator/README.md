# `@d-zero/replicator`

ウェブページとそのリソース（CSS / JS / 画像）をレスポンシブ画像対応でローカルディレクトリに複製する CLI。Phase 1（ページスキャン）と Phase 2（リソースダウンロード）の **2 段階処理** で並列度を独立制御する。**同一ホストのみサポート**（複数ホスト検出時はエラー）。

## Installation

```sh
yarn add @d-zero/replicator
```

## Usage

```sh
npx @d-zero/replicator <url...> -o <output-directory> [options]
```

オプションは `--help`、デバイスプリセットは `src/devices.ts` を参照。

### 主なオプション

- `--limit <n>` … Phase 1（ページスキャン）の並列数（デフォルト 3）
- `--download-limit <n>` … Phase 2（リソースダウンロード）の並列数（デフォルト 10）
- `--only page|resource` … HTML のみ／リソースのみに限定
- `-a, --auth user:pass` … Basic 認証

### `--only` の使い分け

- `page` … リソーススキャンをスキップして HTML のみ高速取得
- `resource` … HTML を除外し、CSS/JS/画像のみ
- 未指定 … 全部

Phase 分離・並列数の WHY・同一ホスト制約の理由・レスポンシブ画像取得時のマルチデバイスシミュレーションは `src/replicate.ts` の JSDoc を参照。

### プログラマティック利用

```ts
import { replicate } from '@d-zero/replicator';

await replicate({
	urls: ['https://example.com'],
	outputDir: './output',
	limit: 2,
	downloadLimit: 5,
});
```
